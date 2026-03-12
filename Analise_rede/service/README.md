# Serviço Windows - Cotação Pesquisa Insumos

Este diretório contém os scripts para configurar e gerenciar o servidor como um Serviço do Windows.

## 📋 Pré-requisitos

1. **NSSM (Non-Sucking Service Manager)** - Será baixado automaticamente pelo script de instalação
2. **Python** instalado e configurado no PATH
3. **Permissões de Administrador** para instalar o serviço

## 🚀 Instalação

### Passo 1: Instalar o serviço
1. Clique com o **botão direito** em `01_instalar_servico.bat`
2. Selecione **"Executar como administrador"**
3. Siga as instruções na tela

### Passo 2: Verificar se está funcionando
1. Abra o navegador
2. Acesse: `http://172.16.253.34:5000`

## 🎮 Comandos de Gerenciamento

| Arquivo | Função |
|---------|--------|
| `01_instalar_servico.bat` | Instala o serviço (executar como admin) |
| `02_iniciar_servico.bat` | Inicia o serviço (executar como admin) |
| `03_parar_servico.bat` | Para o serviço (executar como admin) |
| `04_reiniciar_servico.bat` | Reinicia o serviço (executar como admin) |
| `05_remover_servico.bat` | Remove o serviço (executar como admin) |
| `06_status_servico.bat` | Verifica o status do serviço |

## ⚠️ Importante

- **Após editar arquivos Python**: Execute `04_reiniciar_servico.bat` como administrador
- **Para ver logs de erro**: Verifique os arquivos `logs\stdout.log` e `logs\stderr.log`
- **O IP atual do servidor é**: `172.16.253.34`

## 🔧 Mudando para outro computador

Se você migrar o servidor para outro computador:
1. Copie toda a pasta da aplicação
2. Execute `01_instalar_servico.bat` como administrador
3. Descubra o novo IP com `ipconfig`
4. Atualize o arquivo `AbrirCotacoes.bat` com o novo IP
