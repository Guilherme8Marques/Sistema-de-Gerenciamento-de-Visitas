import os
import sys
from playwright.sync_api import sync_playwright

def verify_dashboard():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=False)
        context = browser.new_context(viewport={"width": 1400, "height": 900})
        page = context.new_page()
        
        errors = []
        page.on("console", lambda msg: errors.append(f"[{msg.type}] {msg.text}") if msg.type == "error" else None)
        page.on("pageerror", lambda err: errors.append(f"PageError: {err.message}"))

        try:
            print("Navegando para a raiz do sistema...")
            page.goto("http://localhost:8080/", wait_until="networkidle")
            page.wait_for_timeout(2000)
            
            # Se tiver input de telefone, esta na login
            if page.locator("input[type='tel']").is_visible():
                print("Preenchendo login...")
                page.fill("input[type='tel']", "19999420794")
                page.fill("input[type='password']", "1234")
                page.click("button:has-text('Entrar')")
                page.wait_for_timeout(3000)

            print("Indo para os relatórios...")
            page.goto("http://localhost:8080/relatorios", wait_until="networkidle")
            page.wait_for_timeout(5000) # Espera a montagem visual da tabela pesada

            artifact_dir = r"C:\Users\luizcypriano\.gemini\antigravity\brain\d5ad9697-7038-4a9d-88da-6c9b18f54a38"
            screenshot_path = os.path.join(artifact_dir, "print_relatorios_final_revertido.png")
            page.screenshot(path=screenshot_path, full_page=True)
            print(f"SUCESSO! Foto salva em: {screenshot_path}")
            
            if errors:
                print("ERROS DE CONSOLE DETECTADOS:")
                for e in errors:
                    print(e)
            else:
                print("Nenhum erro vermelho no console do React detectado !!!")
                
        except Exception as e:
            print(f"FALHA NO SCRIPT: {e}")
        finally:
            browser.close()

if __name__ == "__main__":
    verify_dashboard()
