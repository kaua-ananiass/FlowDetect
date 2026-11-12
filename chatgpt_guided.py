"""Guided building uses ordinary Studio blocks; model output is never executable code."""
import copy
import json
import re

KINDS = {"reuse", "text", "navigate", "keys", "ocr", "table", "manual"}
TABS = {"commands", "workbook", "integrations", "smart-recorder"}


def configuration(event, patch):
    """Typed editor operations only; never selectors, code, paths or live clicks."""
    if not isinstance(patch, dict) or not patch or len(json.dumps(patch)) > 8000:
        raise ValueError("Informe uma configuração válida para o bloco.")
    details = event.setdefault("detalhes", {})
    recognition = event.get("tipo") in {"clicar_imagem", "procurar_texto_ocr"}
    allowed = {"mode", "source", "text", "clicks", "timeout", "confidence", "success", "failure"} if recognition else {"variable", "columns"} if event.get("tipo") == "chrome_tabela" else set()
    if set(patch) - allowed:
        raise ValueError("Essa configuração não é permitida neste tipo de bloco.")
    if recognition:
        targets = details.get("ocr_target_layouts") or []
        if len(targets) > 1 and set(patch) & {"text", "clicks", "success", "failure"}:
            raise ValueError("Este bloco tem vários OCRs. Configure a ação do alvo específico no editor.")
        if targets and set(patch) & {"success", "failure"}:
            raise ValueError("As rotas deste OCR são individuais. Configure-as em Ações por OCR no editor.")
        choices = {"mode": {"image": "imagem", "ocr": "texto_ocr"}, "source": {"chrome": "chrome", "visual": "visual", "screen": "legado"}, "success": {"continuar": "continuar", "parar": "parar"}, "failure": {"continuar": "continuar", "parar": "parar", "tentar_novamente": "tentar_novamente"}}
        fields = {"mode": "modo_reconhecimento", "source": "fonte_ocr", "success": "ao_sucesso", "failure": "ao_nao_encontrar", "timeout": "timeout", "confidence": "confianca"}
        for key, value in patch.items():
            if key in choices:
                if value not in choices[key]: raise ValueError(f"Opção inválida: {key}.")
                if key == "mode" and event["tipo"] == "procurar_texto_ocr" and value != "ocr": raise ValueError("Este bloco é de leitura OCR.")
                details[fields[key]] = choices[key][value]
            elif key == "clicks":
                if type(value) is not int or value not in {0, 1, 2}: raise ValueError("Escolha só confirmar, um ou dois cliques.")
                details.update(clicar=value > 0, cliques=value)
                if targets:
                    routed = bool(targets[0].get("block")) and "bloco" in str(targets[0].get("action", ""))
                    targets[0]["action"] = ("clicar_ir_para_bloco" if value else "confirmar_ir_para_bloco") if routed else ("clicar" if value else "continuar")
                    targets[0]["clicks"] = max(1, value)
            elif key in {"timeout", "confidence"}:
                low, high = (1, 120) if key == "timeout" else (.1, 1)
                if type(value) not in {int, float} or not low <= value <= high: raise ValueError(f"Valor inválido: {key}.")
                details[fields[key]] = value
            elif key == "text":
                if not isinstance(value, str) or len(value) > 2000: raise ValueError("Texto OCR inválido.")
                details["texto" if event["tipo"] == "procurar_texto_ocr" else "texto_ocr_busca"] = value
                # Keep the existing real target list, rather than leaving the old
                # anchor to override the new text during recognition.
                layouts = details.get("ocr_target_layouts") or []
                if len(layouts) > 1: raise ValueError("Este bloco possui vários OCRs. Edite o alvo específico no editor.")
                if layouts: layouts[0]["texto"] = value
    else:
        table = details.setdefault("table", {})
        if "variable" in patch:
            name = patch["variable"]
            if not isinstance(name, str) or not re.fullmatch(r"[A-Za-z_][A-Za-z0-9_]{0,47}", name): raise ValueError("Nome de variável inválido.")
            table["variable"] = name
        if "columns" in patch:
            columns = patch["columns"]
            headers = (table.get("descriptor") or {}).get("headers") or []
            if not isinstance(columns, list) or not columns or any(not isinstance(c, str) or c not in headers for c in columns): raise ValueError("Escolha colunas já mapeadas nesta tabela.")
            table["columns"] = columns
    return event


def block_state(event):
    d = event.get("detalhes") or {}
    kind = event.get("tipo")
    missing = []
    if kind == "clicar_imagem":
        if d.get("modo_reconhecimento") == "texto_ocr" and d.get("fonte_ocr") in {"chrome", "elemento"}:
            if not d.get("texto_ocr_busca"): missing.append("Texto âncora")
        elif not d.get("imagem"): missing.append("Imagem de referência")
    elif kind == "procurar_texto_ocr":
        if d.get("fonte_ocr") == "visual":
            if not d.get("imagem_ocr"): missing.append("Imagem de referência")
        elif not d.get("texto"): missing.append("Texto âncora")
    elif kind == "chrome_tabela":
        t = d.get("table") or {}
        if not (t.get("descriptor") or {}).get("headers"): missing.append("Mapear tabela no Chrome")
        if t.get("mode") == "click" and not (t.get("action") or {}).get("signature"): missing.append("Selecionar botão da linha")
    return {"configured": not missing, "missing": missing, "tested": False}


def context(helper, payload, include_values=False):
    result = helper.contexto_chatgpt(payload)
    events = {e["ordem"]: e for e in payload.get("eventos", [])}
    for block in result["blocks"]:
        event = events[block["source_order"]]
        block.update(block_state(event), block_id=event.get("id"), guide_step_id=(event.get("detalhes") or {}).get("guide_step_id"), guide_id=(event.get("detalhes") or {}).get("guide_id"))
        details = event.get("detalhes") or {}
        if event.get("tipo") in {"clicar_imagem", "procurar_texto_ocr"}:
            block["configuration"] = {"recognition_mode": details.get("modo_reconhecimento", "texto_ocr" if event.get("tipo")=="procurar_texto_ocr" else "imagem"),
                                      "source": details.get("fonte_ocr", "legado"), "has_reference_image": bool(details.get("imagem") or details.get("imagem_ocr")),
                                      "click_during_execution": bool(details.get("clicar")), "click_count": details.get("cliques", 1),
                                      "success": details.get("ao_sucesso", "continuar"), "failure": details.get("ao_nao_encontrar", "parar"),
                                      "timeout_seconds": details.get("timeout", 8), "confidence": details.get("confianca", .8),
                                      "test_action": "Identificar e destacar; nunca clicar", "ocr_regions": len(details.get("ocr_target_layouts") or [])}
        if include_values:
            kind = event.get("tipo")
            if kind == "texto_livre": block["editable"] = {"kind": "text", "text": str(event.get("texto") or "")}
            elif kind == "abrir_url": block["editable"] = {"kind": "navigate", "url": str((event.get("detalhes") or {}).get("url") or "")}
            elif kind in {"tecla", "atalho"}: block["editable"] = {"kind": "keys", "keys": event.get("teclas") or []}
    result["guided_capabilities"] = {"tabs": sorted(TABS), "create": sorted(KINDS - {"reuse", "manual"}),
                                    "screenshots": "Usuário captura pelo editor visual. Imagens não são enviadas ao chat.",
                                    "execution": "Construir e abrir editores não executa a automação."}
    return result


def validate(helper, payload, plan, require_placement=False):
    if not isinstance(plan, dict) or len(json.dumps(plan, ensure_ascii=False)) > 24000:
        raise ValueError("Orientação inválida ou extensa demais. Divida o processo em partes.")
    if plan.get("revision") is not None and plan["revision"] != helper.contexto_chatgpt(payload)["revision"]:
        raise ValueError("O mapa mudou enquanto o assistente respondia. Confira a configuração e peça uma nova orientação.")
    def string(value, name, limit=1800, empty=False):
        if not isinstance(value, str) or (not empty and not value.strip()) or len(value) > limit:
            raise ValueError(f"{name}: informe um texto válido.")
        return value.strip()
    def editorial_text(value, name, fallback=""):
        # Explanatory copy is optional. Never synthesize action fields, targets,
        # positions or values just because the model omitted a tutorial label.
        if value is None:
            return fallback
        value = string(value, name, empty=True)
        return value or fallback
    result = {"message": string(plan.get("message"), "Explicação", 6000), "name": string(plan.get("name"), "Nome", 120),
              "revision": helper.contexto_chatgpt(payload)["revision"], "steps": [], "questions": []}
    steps, questions = plan.get("steps", []), plan.get("questions", [])
    if not isinstance(steps, list) or len(steps) > 30 or not isinstance(questions, list) or len(questions) > 5:
        raise ValueError("Use até 30 etapas e cinco perguntas por orientação.")
    result["questions"] = [string(q, "Pergunta", 1000) for q in questions]
    missing_placement = False
    known_types = helper.conhecimento_blocos_chatgpt()["blocks"]
    source = {e["ordem"]: e for e in payload.get("eventos", []) if e.get("tipo") in known_types}
    targets = helper.conhecimento_blocos_chatgpt()["focus_targets"]
    def focus(value, kind):
        if not isinstance(value, str) or value not in targets or (targets[value].get("types") and kind not in targets[value]["types"]):
            raise ValueError("Esse campo não pertence ao editor do bloco. Atualize a orientação.")
        return value
    ids = set()
    for step in steps:
        if not isinstance(step, dict) or step.get("kind") not in KINDS:
            raise ValueError("Tipo de etapa não permitido na criação guiada.")
        step_id = string(step.get("id"), "Identificador", 60)
        if not re.fullmatch(r"[a-zA-Z0-9_-]+", step_id) or step_id in ids:
            raise ValueError("Use identificadores únicos e estáveis nas etapas.")
        ids.add(step_id)
        item = {"id": step_id, "kind": step["kind"], "title": string(step.get("title"), "Título", 120),
                "instruction": editorial_text(step.get("instruction"), "Como configurar", "Confira os campos deste bloco no mapa."),
                "description": editorial_text(step.get("description"), "Descrição")}
        if item["kind"] == "manual":
            if step.get("tab", "commands") not in TABS: raise ValueError("Destino da etapa não permitido.")
            item["tab"] = step.get("tab", "commands")
        if item["kind"] == "reuse":
            order = step.get("source_order")
            if type(order) is not int or order not in source:
                raise ValueError("O bloco indicado não existe mais. Atualize a orientação.")
            item.update(source_order=order, block_id=source[order].get("id"), **block_state(source[order]))
        elif item["kind"] in {"text", "navigate", "keys"}:
            # Same validation and constructors as the existing proposal path.
            data = {key: step[key] for key in ("text", "url", "keys") if key in step}
            probe = {"name": result["name"], "summary": "Etapa guiada", "revision": result["revision"],
                     "steps": [{"kind": item["kind"], "title": item["title"], **data}], "questions": []}
            helper.preparar_proposta_chatgpt(payload, probe)
            item.update(data)
            if step.get("source_order") is not None:
                order = step["source_order"]
                expected = {"text": {"texto_livre"}, "navigate": {"abrir_url"}, "keys": {"tecla", "atalho"}}
                if type(order) is not int or order not in source or source[order]["tipo"] not in expected[item["kind"]]:
                    raise ValueError("O bloco indicado não corresponde ao tipo desta edição.")
                item.update(source_order=order, block_id=source[order].get("id"), **block_state(source[order]))
        if step.get("focus") is not None:
            kind = source[item["source_order"]]["tipo"] if item["kind"] == "reuse" else {"ocr":"clicar_imagem","table":"chrome_tabela","text":"texto_livre","navigate":"abrir_url","keys":"tecla"}.get(item["kind"])
            if kind is None: raise ValueError("Para destacar um campo, indique um bloco real.")
            item["focus"] = focus(step["focus"], kind)
        if step.get("configuration") is not None:
            prototype = copy.deepcopy(source[item["source_order"]]) if item.get("source_order") else {"tipo": {"ocr": "clicar_imagem", "table": "chrome_tabela"}.get(item["kind"]), "detalhes": {}}
            configuration(prototype, step["configuration"])
            item["configuration"] = copy.deepcopy(step["configuration"])
        if step.get("editor_action") is not None:
            if step["editor_action"] not in {"capture", "test", "map_table"}: raise ValueError("Ação do editor não permitida.")
            kind = source[item["source_order"]]["tipo"] if item.get("source_order") else {"ocr": "clicar_imagem", "table": "chrome_tabela"}.get(item["kind"])
            if kind not in ({"chrome_tabela"} if step["editor_action"] == "map_table" else {"clicar_imagem", "procurar_texto_ocr"}): raise ValueError("Ação incompatível com este bloco.")
            item["editor_action"] = step["editor_action"]
        if step.get("placement") is not None:
            placement = step["placement"]
            if isinstance(placement, dict) and placement.get("anchor_step"):
                anchor_step = next((s for s in result["steps"] if s["id"] == placement["anchor_step"] and s["kind"] != "manual"), None)
                if not anchor_step or placement.get("position") not in {"before", "after"}:
                    raise ValueError("A posição deve indicar uma etapa anterior deste pedido.")
                item["placement"] = {"anchor_step": anchor_step["id"], "position": placement["position"]}
                result["steps"].append(item)
                continue
            if not isinstance(placement, dict) or placement.get("position") not in {"before", "after"} or type(placement.get("anchor_order")) is not int or placement["anchor_order"] not in source:
                raise ValueError("Indique um bloco existente e se a nova etapa fica antes ou depois dele.")
            if placement.get("anchor_id") and placement["anchor_id"] != source[placement["anchor_order"]].get("id"):
                raise ValueError("O bloco de referência mudou. Confira a posição antes de criar.")
            item["placement"] = {"anchor_order": placement["anchor_order"], "anchor_id": source[placement["anchor_order"]].get("id"), "position": placement["position"]}
        elif require_placement and not item.get("block_id") and item["kind"] not in {"reuse", "manual"} and source:
            missing_placement = True
            question = "Ao lado de qual bloco devo criar esta etapa: antes ou depois dele?"
            if question not in result["questions"]: result["questions"].append(question)
        result["steps"].append(item)
    nav = plan.get("navigation")
    if nav is not None:
        if not isinstance(nav, dict) or nav.get("tab") not in TABS:
            raise ValueError("Destino de navegação não permitido.")
        result["navigation"] = {"tab": nav["tab"], "reason": string(nav.get("reason"), "Orientação de navegação", 1000)}
        if nav.get("order") is not None:
            order = nav["order"]
            if type(order) is not int or order not in source or nav["tab"] != "commands":
                raise ValueError("Bloco de destino não encontrado no mapa atual.")
            result["navigation"].update(order=order, block_id=source[order].get("id"))
        if nav.get("focus") is not None:
            if nav.get("order") is None: raise ValueError("Indique o bloco para mostrar esse campo.")
            result["navigation"]["focus"] = focus(nav["focus"], source[nav["order"]]["tipo"])
    if missing_placement:
        result["message"] = "Antes de criar, preciso confirmar a posição: ao lado de qual bloco esta etapa deve ficar, antes ou depois dele? Ainda não criei nenhum bloco."
    return result


def create_step(helper, payload, request):
    if request.get("revision") != helper.contexto_chatgpt(payload)["revision"]:
        raise ValueError("O mapa mudou. Clique em Conferir configuração antes de criar esta etapa.")
    plan = validate(helper, payload, {"name": request.get("name"), "message": "Criar etapa", "steps": [request.get("step")]})
    step = plan["steps"][0]
    if request.get("require_placement") and payload.get("eventos") and not step.get("placement"):
        raise ValueError("Informe antes ou depois de qual bloco criar. Nenhuma seção nova foi criada.")
    if step["kind"] in {"reuse", "manual"}:
        raise ValueError("Essa etapa deve ser aberta no Studio, não duplicada.")
    guide_id = str(request.get("guide_id") or "")
    if not re.fullmatch(r"[a-zA-Z0-9-]{1,80}", guide_id): raise ValueError("Conversa de origem inválida.")
    existing = next((e for e in payload.get("eventos", []) if e.get("detalhes", {}).get("guide_id") == guide_id and e.get("detalhes", {}).get("guide_step_id") == step["id"]), None)
    if existing: return helper.payload_para_resposta(payload), existing["id"]
    if step["kind"] in {"text", "navigate", "keys"}:
        origin, _ = helper.preparar_proposta_chatgpt(payload, {"name": plan["name"], "summary": "Etapa guiada", "revision": plan["revision"], "steps": [step], "questions": []})
        event = origin["eventos"][0]
    elif step["kind"] == "ocr":
        # A normal recognition editor, initially without a captured reference.
        event = helper.criar_bloco_clicar_imagem("", 0, clicar=False, clicks=0, varredura_scroll=False)
    else:
        event = {"tipo": "chrome_tabela", "texto": "Ler tabela", "teclas": [], "intervalo_antes": 0,
                 "detalhes": {"table": {"mode": "list", "variable": "tabela", "descriptor": {}}, "ao_sucesso": "continuar"}}
    event.setdefault("detalhes", {}).update(chatgpt_title=step["title"], guide_id=guide_id, guide_step_id=step["id"])
    if step.get("configuration"): configuration(event, step["configuration"])
    if step.get("placement"):
        import uuid
        placement = step["placement"]
        anchor = next(e for e in payload["eventos"] if e.get("id") == placement["anchor_id"])
        event.update(id=uuid.uuid4().hex, sequencia=anchor.get("sequencia") or "principal")
        helper.inserir_evento(payload, event, anchor["ordem"], placement["position"])
        return helper.salvar_e_retornar(payload), event["id"]
    path = next((p for p in payload.get("map_paths", []) if p.get("chatgpt_guide_id") == guide_id), None)
    if path and any(e.get("sequencia") == path.get("entry_sequence") for e in payload.get("eventos", [])):
        import uuid
        event.update(id=uuid.uuid4().hex, ordem=len(payload["eventos"])+1, sequencia=path["entry_sequence"])
        payload["eventos"].append(event)
        block_id = event["id"]
    else:
        event.update(ordem=1, sequencia="principal")
        path = helper.mesclar_caminho_mapa(payload, {"sequencia_inicial": "principal", "eventos": [event]}, plan["name"], request.get("parent") or "principal")
        path.update(chatgpt_guide_id=guide_id, engine="chrome", page_id=str(request.get("pageId") or "1"))
        block_id = payload["eventos"][-1]["id"]
    return helper.salvar_e_retornar(payload), block_id


def update_step(helper, payload, request):
    if request.get("revision") != helper.contexto_chatgpt(payload)["revision"]:
        raise ValueError("O mapa mudou. Confira a configuração antes de salvar esta edição.")
    event = next((e for e in payload.get("eventos", []) if e.get("id") == request.get("block_id")), None)
    if not event: raise ValueError("O bloco foi removido. Atualize a orientação.")
    step = request.get("step") or {}
    expected = {"text": "texto_livre", "navigate": "abrir_url", "keys": {"tecla", "atalho"}}
    kind = step.get("kind")
    allowed = expected.get(kind)
    if not allowed or event.get("tipo") not in (allowed if isinstance(allowed, set) else {allowed}):
        raise ValueError("Abra o editor do Studio para alterar esse tipo de bloco.")
    origin, _ = helper.preparar_proposta_chatgpt(payload, {"name": "Edição guiada", "summary": "Editar bloco", "revision": request["revision"], "steps": [step], "questions": []})
    replacement = origin["eventos"][0]
    # Only typed fields are replaced. Identity, sequence, routing and unrelated settings survive.
    fields = {"text": {"texto"}, "navigate": {"url"}, "keys": set()}[kind]
    details = event.setdefault("detalhes", {})
    for field in fields:
        if field in replacement.get("detalhes", {}): details[field] = replacement["detalhes"][field]
    if kind == "text": event["texto"] = step["text"]
    elif kind == "keys":
        event["teclas"] = replacement["teclas"]
        event["tipo"] = replacement["tipo"]
    details["chatgpt_title"] = step["title"].strip()
    if kind != "text": event["texto"] = helper.formatar_evento(event.get("teclas") or [], event["tipo"], metadados=details)
    event["comando_python"] = helper.montar_comando_python(event.get("teclas") or [], event["tipo"], texto_livre=event["texto"] if kind == "text" else None, metadados=details)
    return helper.salvar_e_retornar(payload), event["id"]


def assist(helper, payload, request):
    """One revision-guarded editor transaction with a local, opaque undo token."""
    from pathlib import Path
    import uuid
    undo_path = Path(".flowdetect_ai_editor_undo.json")
    if request.get("revision") != helper.contexto_chatgpt(payload)["revision"]:
        raise ValueError("O mapa mudou. Peça ao assistente para conferir antes de alterar.")
    if request["action"] == "ai_assist_undo":
        saved = json.loads(undo_path.read_text(encoding="utf-8")) if undo_path.exists() else {}
        if not request.get("undo_token") or saved.get("token") != request["undo_token"] or saved.get("revision") != request["revision"]:
            raise ValueError("A edição não pode mais ser desfeita porque o mapa mudou.")
        payload.clear(); payload.update(saved["before"])
        roadmap = helper.salvar_e_retornar(payload)
        undo_path.unlink(missing_ok=True)
        return {"roadmap": roadmap, "context": context(helper, payload), "message": "Última edição do assistente desfeita."}
    before = copy.deepcopy(payload)
    plan = validate(helper, payload, {"name": request.get("name", "Fazer comigo"), "message": "Configurar etapa", "steps": [request.get("step")]})
    step = plan["steps"][0]
    if not step.get("block_id") and not step.get("placement") and payload.get("eventos"):
        raise ValueError("Antes de criar, informe ao lado de qual bloco e se fica antes ou depois. Nenhum bloco foi criado.")
    if step.get("block_id"):
        event = next(e for e in payload["eventos"] if e.get("id") == step["block_id"])
        if step.get("configuration"):
            configuration(event, step["configuration"])
            event["comando_python"] = helper.montar_comando_python(event.get("teclas") or [], event["tipo"], metadados=event.get("detalhes") or {})
            roadmap, block_id = helper.salvar_e_retornar(payload), event["id"]
        elif step["kind"] in {"text", "keys", "navigate"}:
            roadmap, block_id = update_step(helper, payload, {**request, "step": step, "block_id": step["block_id"]})
        else:
            return {"roadmap": helper.payload_para_resposta(payload), "block_id": step["block_id"], "context": context(helper, payload), "message": "Editor aberto sem alterar o bloco."}
    else:
        roadmap, block_id = create_step(helper, payload, {**request, "step": step})
    token = uuid.uuid4().hex
    after = context(helper, payload)
    temporary = undo_path.with_suffix(".tmp")
    temporary.write_text(json.dumps({"token": token, "revision": after["revision"], "before": before}, ensure_ascii=False), encoding="utf-8")
    temporary.replace(undo_path)
    return {"roadmap": roadmap, "block_id": block_id, "context": after, "undo_token": token, "message": "Configuração aplicada no bloco real. A automação não foi executada."}
