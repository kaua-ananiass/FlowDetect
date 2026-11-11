"""Guided building uses ordinary Studio blocks; model output is never executable code."""
import copy
import json
import re

KINDS = {"reuse", "text", "navigate", "keys", "ocr", "table", "manual"}
TABS = {"commands", "workbook", "integrations", "smart-recorder"}


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
        block.update(block_state(event), block_id=event.get("id"), guide_step_id=(event.get("detalhes") or {}).get("guide_step_id"))
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


def validate(helper, payload, plan):
    if not isinstance(plan, dict) or len(json.dumps(plan, ensure_ascii=False)) > 24000:
        raise ValueError("Orientação inválida ou extensa demais. Divida o processo em partes.")
    if plan.get("revision") is not None and plan["revision"] != helper.contexto_chatgpt(payload)["revision"]:
        raise ValueError("O mapa mudou enquanto o assistente respondia. Confira a configuração e peça uma nova orientação.")
    def string(value, name, limit=1800, empty=False):
        if not isinstance(value, str) or (not empty and not value.strip()) or len(value) > limit:
            raise ValueError(f"{name}: informe um texto válido.")
        return value.strip()
    result = {"message": string(plan.get("message"), "Explicação", 6000), "name": string(plan.get("name"), "Nome", 120),
              "revision": helper.contexto_chatgpt(payload)["revision"], "steps": [], "questions": []}
    steps, questions = plan.get("steps", []), plan.get("questions", [])
    if not isinstance(steps, list) or len(steps) > 30 or not isinstance(questions, list) or len(questions) > 5:
        raise ValueError("Use até 30 etapas e cinco perguntas por orientação.")
    result["questions"] = [string(q, "Pergunta", 1000) for q in questions]
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
                "instruction": string(step.get("instruction"), "Como configurar"),
                "description": string(step.get("description", ""), "Descrição", empty=True)}
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
        if step.get("focus") is not None:
            kind = source[item["source_order"]]["tipo"] if item["kind"] == "reuse" else {"ocr":"clicar_imagem","table":"chrome_tabela","text":"texto_livre","navigate":"abrir_url","keys":"tecla"}.get(item["kind"])
            if kind is None: raise ValueError("Para destacar um campo, indique um bloco real.")
            item["focus"] = focus(step["focus"], kind)
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
    return result


def create_step(helper, payload, request):
    if request.get("revision") != helper.contexto_chatgpt(payload)["revision"]:
        raise ValueError("O mapa mudou. Clique em Conferir configuração antes de criar esta etapa.")
    plan = validate(helper, payload, {"name": request.get("name"), "message": "Criar etapa", "steps": [request.get("step")]})
    step = plan["steps"][0]
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
