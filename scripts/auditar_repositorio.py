"""Read-only audit of versioned build inputs and local source references."""
import argparse
import ast
import json
from pathlib import Path
import re
import subprocess
import sys

ROOT = Path(__file__).resolve().parents[1]
GENERATED = {"tauri_gerador/src-tauri/installer_support/python-installer.exe"}


def audit(root=ROOT):
    root = Path(root).resolve()
    tracked = set(subprocess.check_output(['git', 'ls-files', '-z'], cwd=root).decode('utf-8').split('\0'))
    errors, generated = [], []
    checked = set()

    def require(path, owner):
        path = Path(path).resolve()
        if not path.is_relative_to(root):
            errors.append(f'{owner}: referencia fora do repositorio')
            return
        relative = path.relative_to(root).as_posix()
        checked.add(relative)
        if relative in GENERATED:
            generated.append(relative)
            return
        if not path.exists():
            errors.append(f'{owner}: ausente {relative}')
        elif path.is_file() and relative not in tracked:
            errors.append(f'{owner}: arquivo nao versionado {relative}')
        elif path.is_dir() and not any(name.startswith(relative + '/') for name in tracked):
            errors.append(f'{owner}: pasta sem conteudo versionado {relative}')

    for path in ['package.json', 'package-lock.json', 'scripts/test-node.cjs']:
        require(root / path, 'ferramentas de teste')
    for product in ['tauri_gerador', 'flowdetect_agent', 'flowdetect_runner']:
        base = root / product / 'src-tauri'
        config = base / 'tauri.conf.json'
        require(config, product)
        for name in ['Cargo.toml', 'Cargo.lock', 'build.rs']:
            require(base / name, product)
        for name in ['package.json', 'package-lock.json']:
            require(base.parent / name, product)
        data = json.loads(config.read_text(encoding='utf-8-sig'))
        require(base / data['build']['frontendDist'], product)
        bundle = data['bundle']
        for name in list(bundle['resources']) + bundle.get('icon', []):
            require(base / name, product)
        nsis = bundle.get('windows', {}).get('nsis', {})
        for key in ['installerIcon', 'uninstallerIcon', 'headerImage', 'uninstallerHeaderImage', 'sidebarImage', 'installerHooks']:
            if key in nsis:
                require(base / nsis[key], product)
        for filename in (base / 'src').rglob('*.rs'):
            require(filename, product)
            content = filename.read_text(encoding='utf-8-sig')
            for target in re.findall(r'(?:include_bytes!\(|include_str!\(|#\[path\s*=\s*)"([^"\n]+)"', content):
                require(filename.parent / target, filename.name)
            default_modules = re.sub(r'#\[path\s*=\s*"[^"]+"\]\s*mod\s+\w+\s*;', '', content)
            for module in re.findall(r'^\s*(?:pub(?:\([^)]*\))?\s+)?mod\s+(\w+)\s*;', default_modules, re.M):
                candidates = [filename.parent / (module + '.rs'), filename.parent / module / 'mod.rs']
                require(next((p for p in candidates if p.exists()), candidates[0]), filename.name)

    for product in ['tauri_gerador', 'flowdetect_agent', 'flowdetect_runner', 'flowdetect_chrome']:
        folder = root / product / 'web' if product != 'flowdetect_chrome' else root / product
        for filename in folder.rglob('*'):
            if filename.suffix not in {'.html', '.js', '.css'}:
                continue
            require(filename, product)
            content = filename.read_text(encoding='utf-8-sig')
            references = re.findall(r'(?:\bfrom\s*|\bimport\s*\(?)\s*[\'"](\.{1,2}/[^\'"\n]+)[\'"]', content)
            if filename.suffix == '.html':
                references += re.findall(r'(?:src|href)=[\'"]([^\'"]+)[\'"]', content)
            if filename.suffix == '.css':
                references += re.findall(r'url\([\'"]?([^\'"\)]+)', content)
            for reference in references:
                if re.match(r'^(?:[a-z]+:|//|#)', reference, re.I) or '${' in reference:
                    continue
                reference = reference.split('?', 1)[0].split('#', 1)[0]
                if reference:
                    require(filename.parent / reference, filename.name)

    for filename in root.glob('*.py'):
        if filename.name not in tracked:
            continue
        for node in ast.walk(ast.parse(filename.read_text(encoding='utf-8-sig'))):
            names = [item.name for item in node.names] if isinstance(node, ast.Import) else [node.module] if isinstance(node, ast.ImportFrom) and node.module else []
            for name in names:
                local = root / (name.split('.')[0] + '.py')
                if local.exists():
                    require(local, filename.name)

    support = root / 'tauri_gerador/src-tauri/installer_support'
    for path in ['Tesseract-OCR/tesseract.exe', 'Tesseract-OCR/tessdata/eng.traineddata', 'python_runtime_prebuilt/python.exe', 'python_runtime_prebuilt/python312.dll', 'python_runtime_prebuilt/python312.zip', 'runtime_seed/comandos_teclado.py']:
        require(support / path, 'runtime Windows')
    require(root / 'scripts/preparar_build_windows.ps1', 'prerequisito gerado')
    version = json.loads((root / 'flowdetect_chrome/manifest.json').read_text(encoding='utf-8-sig'))['version']
    for name, symbol in [('flowdetect_chrome/service_worker.js', 'RUNTIME_VERSION'), ('flowdetect_chrome/content.js', 'CONTENT_RUNTIME_VERSION'), ('flowdetect_chrome/sidepanel.js', 'REQUIRED_RUNTIME_VERSION'), ('tauri_gerador/src-tauri/src/chrome_test_bridge.rs', 'EXTENSION_VERSION')]:
        match = re.search(symbol + r'[^=]*=\s*"([^"]+)"', (root / name).read_text(encoding='utf-8-sig'))
        if not match or match[1] != version:
            errors.append(f'{name}: versao da ponte diferente de {version}')
    return {'ok': not errors, 'checked_references': len(checked), 'generated_prerequisites': sorted(set(generated)), 'errors': sorted(set(errors))}


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--json', action='store_true')
    args = parser.parse_args()
    result = audit()
    if args.json:
        print(json.dumps(result, ensure_ascii=False, indent=2))
    else:
        print(f"Referencias verificadas: {result['checked_references']}; erros: {len(result['errors'])}")
        for error in result['errors']:
            print(error)
        for generated in result['generated_prerequisites']:
            print(f'Gerado pelo preparo Windows: {generated}')
    sys.exit(0 if result['ok'] else 1)
