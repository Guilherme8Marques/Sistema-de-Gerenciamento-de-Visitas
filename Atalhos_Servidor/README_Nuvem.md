# Gestão do Servidor na Nuvem (GCP)
Como a aplicação agora roda em um servidor Linux (Ubuntu na Google Cloud) usando Docker, os atalhos `.bat` (que são do Windows) **não funcionam mais no ambiente de produção**.

Para facilitar sua vida, criei scripts equivalentes em `.sh` que você pode rodar **LÁ NA NUVEM**, dentro do terminal do Google Cloud.

## Arquivos de Atalho (Scripts .sh)

Os atalhos abaixo substituem os `.bat` antigos e devem ser rodados na pasta raiz do projeto na nuvem (onde fica o `docker-compose.yml`):

### 1. Parar o Servidor
**O que mudou:** Substitui o `03_Parar_Servico.bat`. Ele desliga os containers de forma segura.
**Como usar na nuvem:** 
```bash
./Atalhos_Servidor/01_Nuvem_Parar_Servidor.sh
```

### 2. Ligar o Servidor
**O que mudou:** Substitui o `02_Iniciar_Servico.bat`. Ele volta a ligar os containers parados.
**Como usar na nuvem:** 
```bash
./Atalhos_Servidor/02_Nuvem_Ligar_Servidor.sh
```

### 3. Limpar o Banco de Dados
**O que mudou:** Limpa o banco de forma segura. Ele tem uma trava de segurança que pausa o servidor antes de limpar, evitando que o "Autosave" desfaça o seu trabalho.
**Como usar na nuvem:** 
```bash
./Atalhos_Servidor/03_Nuvem_Limpar_Banco.sh
```

### 4. Importar Planilhas (CSV e XLSX)
**O que mudou:** Processa os dados da pasta `dados/`. Também tem a mesma trava de segurança que o atalho de limpar. (Lembre-se de primeiro enviar as planilhas para a pasta `dados/` no servidor).
**Como usar na nuvem:** 
```bash
./Atalhos_Servidor/04_Nuvem_Importar_Planilhas.sh
```

---

## E se os atalhos negarem a permissão no Linux?
A primeira vez que você baixar esses atalhos no Linux, pode ser necessário dar "permissão de execução" a eles. Para fazer isso, rode apenas uma vez:
```bash
chmod +x Atalhos_Servidor/*.sh
```
