import argparse
import json
import re
import shutil
import subprocess
import sys
import tempfile
import time
from pathlib import Path


try:
    from playwright.sync_api import sync_playwright
except Exception:  # pragma: no cover - reported as a friendly runtime error.
    sync_playwright = None


DEFAULT_CDP_URLS = ("http://127.0.0.1:9222", "http://localhost:9222")


CAPTURE_SCRIPT = r"""
(() => {
  if (window.__flowDetectCaptureActive) return true;
  window.__flowDetectCaptureActive = true;
  window.__flowDetectCapturedElement = null;

  const selectors = [
    'input', 'textarea', 'select', 'button', 'a',
    '[role="button"]', '[role="link"]', '[role="checkbox"]', '[role="textbox"]',
    '[contenteditable="true"]', 'label', '[aria-label]', '[title]'
  ].join(',');

  const style = document.createElement('style');
  style.id = '__flowdetect_capture_style';
  style.textContent = `
    #__flowdetect_capture_box {
      position: fixed;
      pointer-events: none;
      z-index: 2147483647;
      border: 2px solid #12B5CB;
      border-radius: 8px;
      box-shadow: 0 0 0 9999px rgba(7,17,31,.10), 0 0 24px rgba(94,234,212,.85);
      background: rgba(18,181,203,.08);
      transition: left .06s linear, top .06s linear, width .06s linear, height .06s linear;
      display: none;
    }
    #__flowdetect_capture_badge {
      position: fixed;
      pointer-events: none;
      z-index: 2147483647;
      left: 16px;
      top: 16px;
      padding: 9px 13px;
      border-radius: 999px;
      background: #07111F;
      border: 1px solid rgba(18,181,203,.65);
      color: #E6F7FF;
      font: 700 12px/1.2 system-ui, -apple-system, Segoe UI, sans-serif;
      letter-spacing: .08em;
      box-shadow: 0 14px 34px rgba(0,0,0,.35), 0 0 18px rgba(18,181,203,.45);
    }
  `;
  document.documentElement.appendChild(style);

  const box = document.createElement('div');
  box.id = '__flowdetect_capture_box';
  document.documentElement.appendChild(box);

  const badge = document.createElement('div');
  badge.id = '__flowdetect_capture_badge';
  badge.textContent = 'FLOWDETECT - CLIQUE NO ELEMENTO';
  document.documentElement.appendChild(badge);

  function cleanText(value) {
    return String(value || '').replace(/\s+/g, ' ').trim();
  }

  function cssEscape(value) {
    if (window.CSS && CSS.escape) return CSS.escape(value);
    return String(value || '').replace(/["\\#.:,[\]>+~*^$|= !]/g, '\\$&');
  }

  function visibleText(el) {
    const tag = (el.tagName || '').toLowerCase();
    if (tag === 'input' || tag === 'textarea') return cleanText(el.value || el.getAttribute('value') || '');
    return cleanText(el.innerText || el.textContent || '');
  }

  function textNear(el) {
    const id = el.getAttribute('id');
    const labelTexts = [];
    if (id) {
      document.querySelectorAll(`label[for="${cssEscape(id)}"]`).forEach(label => labelTexts.push(visibleText(label)));
    }
    const wrapped = el.closest('label');
    if (wrapped) labelTexts.push(visibleText(wrapped));
    const parent = el.parentElement;
    if (parent) labelTexts.push(visibleText(parent).slice(0, 180));
    return cleanText(labelTexts.filter(Boolean).join(' | ')).slice(0, 220);
  }

  function cssSelector(el) {
    if (!el || el.nodeType !== 1) return '';
    if (el.id) return `#${cssEscape(el.id)}`;
    const parts = [];
    let current = el;
    while (current && current.nodeType === 1 && current !== document.documentElement) {
      let part = current.tagName.toLowerCase();
      const name = current.getAttribute('name');
      const placeholder = current.getAttribute('placeholder');
      const aria = current.getAttribute('aria-label');
      if (name) {
        part += `[name="${String(name).replace(/"/g, '\\"')}"]`;
        parts.unshift(part);
        break;
      }
      if (placeholder) {
        part += `[placeholder="${String(placeholder).replace(/"/g, '\\"')}"]`;
        parts.unshift(part);
        break;
      }
      if (aria) {
        part += `[aria-label="${String(aria).replace(/"/g, '\\"')}"]`;
        parts.unshift(part);
        break;
      }
      const parent = current.parentElement;
      if (parent) {
        const siblings = Array.from(parent.children).filter(child => child.tagName === current.tagName);
        if (siblings.length > 1) part += `:nth-of-type(${siblings.indexOf(current) + 1})`;
      }
      parts.unshift(part);
      current = parent;
    }
    return parts.join(' > ');
  }

  function xpath(el) {
    if (!el || el.nodeType !== 1) return '';
    if (el.id) return `//*[@id="${String(el.id).replace(/"/g, '\\"')}"]`;
    const parts = [];
    let current = el;
    while (current && current.nodeType === 1) {
      const tag = current.tagName.toLowerCase();
      const siblings = current.parentNode ? Array.from(current.parentNode.children).filter(child => child.tagName === current.tagName) : [];
      const index = siblings.length > 1 ? `[${siblings.indexOf(current) + 1}]` : '';
      parts.unshift(`${tag}${index}`);
      current = current.parentElement;
    }
    return `/${parts.join('/')}`;
  }

  function friendlyName(el) {
    const tag = (el.tagName || '').toLowerCase();
    const type = (el.getAttribute('type') || '').toLowerCase();
    const text = cleanText(el.getAttribute('placeholder') || el.getAttribute('aria-label') || el.getAttribute('title') || visibleText(el) || textNear(el));
    const target = text ? `"${text.slice(0, 70)}"` : 'da pagina';
    if (tag === 'input' && ['checkbox', 'radio'].includes(type)) return `Marcador ${target}`;
    if (tag === 'input' || tag === 'textarea' || el.isContentEditable) return `Campo ${target}`;
    if (tag === 'select') return `Lista ${target}`;
    if (tag === 'button' || el.getAttribute('role') === 'button' || ['button', 'submit', 'reset'].includes(type)) return `Botao ${target}`;
    if (tag === 'a' || el.getAttribute('role') === 'link') return `Link ${target}`;
    return `Texto ${target}`;
  }

  function probableType(el) {
    const tag = (el.tagName || '').toLowerCase();
    const type = (el.getAttribute('type') || '').toLowerCase();
    const role = (el.getAttribute('role') || '').toLowerCase();
    if (tag === 'select') return 'select';
    if (tag === 'textarea') return 'textarea';
    if (tag === 'a' || role === 'link') return 'link';
    if (tag === 'button' || role === 'button' || ['button', 'submit', 'reset'].includes(type)) return 'button';
    if (tag === 'input' && ['checkbox', 'radio'].includes(type)) return 'choice';
    if (tag === 'input') return 'text_input';
    if (el.isContentEditable) return 'editable';
    return 'generic';
  }

  function buildPayload(el) {
    const attrs = {};
    for (const attr of Array.from(el.attributes || [])) attrs[attr.name] = attr.value;
    return {
      nome_amigavel: friendlyName(el),
      tipo_elemento: probableType(el),
      acao_sugerida: probableType(el) === 'text_input' || probableType(el) === 'textarea' || probableType(el) === 'editable'
        ? 'preencher'
        : (probableType(el) === 'select' ? 'selecionar_texto' : (probableType(el) === 'choice' ? 'marcar_checkbox' : 'clicar')),
      tag: (el.tagName || '').toLowerCase(),
      type: (el.getAttribute('type') || '').toLowerCase(),
      texto_visivel: visibleText(el),
      id: el.getAttribute('id') || '',
      name: el.getAttribute('name') || '',
      placeholder: el.getAttribute('placeholder') || '',
      aria_label: el.getAttribute('aria-label') || '',
      title: el.getAttribute('title') || '',
      role: el.getAttribute('role') || '',
      texto_proximo: textNear(el),
      css_selector: cssSelector(el),
      xpath: xpath(el),
      url_origem: location.href,
      html_original: el.outerHTML || '',
      attributes: attrs
    };
  }

  function pickElement(target) {
    return target && target.closest ? (target.closest(selectors) || target) : target;
  }

  function highlight(el) {
    if (!el || !el.getBoundingClientRect) return;
    const rect = el.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) return;
    box.style.display = 'block';
    box.style.left = `${Math.max(0, rect.left - 4)}px`;
    box.style.top = `${Math.max(0, rect.top - 4)}px`;
    box.style.width = `${rect.width + 8}px`;
    box.style.height = `${rect.height + 8}px`;
  }

  function cleanup() {
    window.__flowDetectCaptureActive = false;
    document.removeEventListener('mousemove', onMove, true);
    document.removeEventListener('mouseover', onMove, true);
    document.removeEventListener('click', onClick, true);
    box.remove();
    badge.remove();
    style.remove();
  }

  function onMove(event) {
    highlight(pickElement(event.target));
  }

  function onClick(event) {
    event.preventDefault();
    event.stopPropagation();
    event.stopImmediatePropagation();
    const element = pickElement(event.target);
    window.__flowDetectCapturedElement = buildPayload(element);
    cleanup();
    return false;
  }

  document.addEventListener('mousemove', onMove, true);
  document.addEventListener('mouseover', onMove, true);
  document.addEventListener('click', onClick, true);
  return true;
})();
"""


def json_print(payload):
    print(json.dumps(payload, ensure_ascii=False))


def chrome_executable():
    candidates = [
        Path(r"C:\Program Files\Google\Chrome\Application\chrome.exe"),
        Path(r"C:\Program Files (x86)\Google\Chrome\Application\chrome.exe"),
    ]
    for candidate in candidates:
        if candidate.exists():
            return str(candidate)
    found = shutil.which("chrome") or shutil.which("chrome.exe")
    if found:
        return found
    return None


def connect_or_launch(playwright, url="", allow_launch=False):
    chromium = playwright.chromium
    last_error = None
    for cdp_url in DEFAULT_CDP_URLS:
        try:
            browser = chromium.connect_over_cdp(cdp_url)
            context = browser.contexts[0] if browser.contexts else browser.new_context(no_viewport=True)
            pages = [page for page in context.pages if not page.is_closed()]
            visible_pages = [page for page in pages if not str(getattr(page, "url", "") or "").startswith("about:")]
            page = visible_pages[-1] if visible_pages else (pages[-1] if pages else None)
            if page is None:
                raise RuntimeError("Chrome conectado, mas nenhuma aba real esta aberta.")
            if url:
                page.goto(url, wait_until="domcontentloaded")
            return browser, context, page, f"cdp:{cdp_url}"
        except Exception as error:
            last_error = error

    if not allow_launch:
        raise RuntimeError(
            "Nao consegui conectar na aba atual do Chrome. "
            "Abra o site pelo bloco Abrir URL do FlowDetect com navegador Chrome/Edge "
            "ou feche o Chrome e execute novamente para ele abrir com a porta 9222. "
            f"Ultimo erro: {last_error}"
        )

    executable = chrome_executable()
    user_data_dir = Path(tempfile.gettempdir()) / "flowdetect_chrome_capture_profile"
    args = [
        "--remote-debugging-port=9222",
        f"--user-data-dir={user_data_dir}",
        "--remote-allow-origins=*",
        "--no-first-run",
        "--no-default-browser-check",
        "--start-maximized",
    ]
    if url:
        args.append(url)
    if executable:
        subprocess.Popen([executable, *args], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
        deadline = time.time() + 6
        while time.time() < deadline:
            for cdp_url in DEFAULT_CDP_URLS:
                try:
                    browser = chromium.connect_over_cdp(cdp_url)
                    context = browser.contexts[0] if browser.contexts else browser.new_context(no_viewport=True)
                    pages = [page for page in context.pages if not page.is_closed()]
                    visible_pages = [
                        page
                        for page in pages
                        if not str(getattr(page, "url", "") or "").startswith("about:")
                    ]
                    page = visible_pages[-1] if visible_pages else (pages[-1] if pages else context.new_page())
                    return browser, context, page, f"launch-cdp:{cdp_url}"
                except Exception as error:
                    last_error = error
            time.sleep(0.25)

    raise RuntimeError(
        "O Chrome de captura foi aberto, mas a porta 9222 nao respondeu. "
        "Feche os processos do Chrome em segundo plano pelo Gerenciador de Tarefas e tente novamente. "
        f"Ultimo erro: {last_error}"
    )


def ensure_playwright():
    if sync_playwright is None:
        raise RuntimeError("Playwright nao esta instalado. Instale com: python -m pip install playwright")
    return sync_playwright().start()


def normalize_action(action):
    value = str(action or "").strip().lower()
    aliases = {
        "preencher_campo": "preencher",
        "clicar": "clicar",
        "capturar_texto": "pegar_texto",
        "esperar_elemento": "esperar",
        "verificar_existe": "verificar_existe",
        "selecionar_opcao": "selecionar_texto",
        "marcar_checkbox": "marcar_checkbox",
    }
    return aliases.get(value, value or "clicar")


def main():
    parser = argparse.ArgumentParser()
    sub = parser.add_subparsers(dest="command", required=True)
    capture = sub.add_parser("capture-element")
    capture.add_argument("--url", default="")
    capture.add_argument("--timeout", type=int, default=60000)

    test = sub.add_parser("test-element")
    test.add_argument("--details-json", required=True)
    test.add_argument("--timeout", type=int, default=10000)

    open_site = sub.add_parser("open-site")
    open_site.add_argument("--url", required=True)

    args = parser.parse_args()

    runtime = ensure_playwright()
    try:
        if args.command == "open-site":
            browser, _context, page, source = connect_or_launch(runtime, args.url, allow_launch=True)
            try:
                page.bring_to_front()
            except Exception:
                pass
            json_print({"ok": True, "message": "Site aberto no Chrome.", "source": source, "url": page.url})
            return

        if args.command == "capture-element":
            browser, _context, page, source = connect_or_launch(runtime, args.url, allow_launch=False)
            try:
                page.bring_to_front()
            except Exception:
                pass
            page.evaluate(CAPTURE_SCRIPT)
            payload = page.wait_for_function("window.__flowDetectCapturedElement", timeout=args.timeout).json_value()
            json_print({"ok": True, "source": source, "element": payload})
            return

        if args.command == "test-element":
            details = json.loads(args.details_json or "{}")
            browser, _context, page, source = connect_or_launch(runtime, "", allow_launch=False)
            try:
                page.bring_to_front()
            except Exception:
                pass
            if details.get("require_unique"):
                target = details.get("alvo") or {}
                locator = locator_from_target(page, target)
                try:
                    locator.first.wait_for(state="visible", timeout=args.timeout)
                except Exception:
                    pass
                count = locator.count()
                found = count == 1 and locator.first.is_visible()
                message = (
                    "Elemento unico e visivel encontrado no Chrome." if found else
                    f"O seletor encontrou {count} elemento(s) na aba. Ajuste-o para encontrar exatamente um elemento visivel."
                )
            else:
                found = test_details(page, details, args.timeout)
                message = "Elemento encontrado com sucesso." if found else "Nao encontrei esse elemento. Deseja capturar novamente?"
            json_print({
                "ok": found,
                "source": source,
                "message": message,
            })
            return
    except Exception as error:
        json_print({"ok": False, "message": str(error)})
        return
    finally:
        runtime.stop()


def candidate_targets(details):
    elemento = details.get("elemento") or {}
    alvo = details.get("alvo") or {}
    selectors = details.get("seletores") or []
    by_method = {str(item.get("metodo", "")).lower(): item for item in selectors if isinstance(item, dict)}

    def add(method, value="", selector_css="", role=""):
      if str(value or selector_css or "").strip():
          yield {"metodo": method, "valor": value, "seletor_css": selector_css, "role": role}

    yield from add("id", elemento.get("id") or by_method.get("id", {}).get("valor"), by_method.get("id", {}).get("seletor_css", ""))
    yield from add("name", elemento.get("name") or by_method.get("name", {}).get("valor"), by_method.get("name", {}).get("seletor_css", ""))
    yield from add("placeholder", elemento.get("placeholder") or by_method.get("placeholder", {}).get("valor"), by_method.get("placeholder", {}).get("seletor_css", ""))
    yield from add("aria-label", elemento.get("aria_label") or by_method.get("aria-label", {}).get("valor"), by_method.get("aria-label", {}).get("seletor_css", ""))
    yield from add("text", elemento.get("texto_visivel") or elemento.get("text") or by_method.get("text", {}).get("valor"))
    yield from add("text", elemento.get("texto_proximo") or by_method.get("nearby_text", {}).get("valor"))
    yield from add("css", elemento.get("css_selector") or alvo.get("seletor_css") or by_method.get("css", {}).get("valor"))
    yield from add("xpath", elemento.get("xpath") or by_method.get("xpath", {}).get("valor"))
    if alvo:
        yield alvo


def locator_from_target(page, target):
    method = str(target.get("metodo") or "css").strip().lower()
    value = str(target.get("valor") or "").strip()
    css = str(target.get("seletor_css") or "").strip()
    role = str(target.get("role") or "").strip()
    if method == "id":
        safe_value = value.replace("\\", "\\\\").replace('"', '\\"')
        return page.locator(f'[id="{safe_value}"]')
    if method == "name":
        return page.locator(css or f'[name="{value}"]')
    if method == "placeholder":
        return page.get_by_placeholder(value)
    if method == "aria-label":
        return page.get_by_label(value)
    if method == "text":
        return page.get_by_text(value, exact=True)
    if method == "role" and role:
        return page.get_by_role(role, name=value, exact=True)
    if method == "xpath":
        return page.locator(value if value.startswith("xpath=") else f"xpath={value}")
    return page.locator(value or css)


def test_details(page, details, timeout):
    deadline = time.time() + max(0.5, timeout / 1000)
    last_error = None
    for target in candidate_targets(details):
        remaining = max(500, int((deadline - time.time()) * 1000))
        if remaining <= 0:
            break
        try:
            locator = locator_from_target(page, target).first
            locator.wait_for(state="visible", timeout=remaining)
            locator.evaluate(
                """element => {
                  const rect = element.getBoundingClientRect();
                  const box = document.createElement('div');
                  box.style.cssText = `position:fixed;left:${rect.left-4}px;top:${rect.top-4}px;width:${rect.width+8}px;height:${rect.height+8}px;z-index:2147483647;pointer-events:none;border:3px solid #22C55E;border-radius:10px;box-shadow:0 0 28px rgba(34,197,94,.9);background:rgba(34,197,94,.08)`;
                  document.documentElement.appendChild(box);
                  setTimeout(() => box.remove(), 1400);
                }"""
            )
            return True
        except Exception as error:
            last_error = error
    return False


if __name__ == "__main__":
    try:
        main()
    except Exception as error:
        print(str(error), file=sys.stderr)
        raise SystemExit(1)
