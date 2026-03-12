# Serviço Windows - Ferramenta de Visitas

Esta pasta contém atalhos poderosos para rodar o backend da sua aplicação de forma **invisível e blindada**, através de um **Serviço do Windows** usando a ferramenta NSSM (mesma arquitetura usada no projeto `Analise_rede`).

## Por que usar isso?
1. **Fim dos Zumbis**: Ao rodar como serviço, o Node.js não fica prezo no terminal do VS Code. Quando você clica em Parar, ele realmente morre e libera a porta 5000 imediatamente.
2. **Auto-Start Seguro**: O servidor ligará sozinho assim que o computador ligar.
3. **Não polui sua tela**: Nunca mais precisará deixar uma tela preta aberta o tempo todo. Vira um serviço silencioso de fundo.

## 🚀 Como Instalar pela primeira vez
1. Dê um Duplo Clique em **`01_Instalar_Servico_Invisivel.bat`** (Se pedir, confirme "Sim" para Administrador).
2. Ele baixará o NSSM sozinho, criará o serviço e deixará ele rodando na porta 5000.
3. Pronto! Feche tudo e seu servidor já está online.

## 🎛️ Como Gerenciar no dia-a-dia
Com o serviço instalado, você controla tudo apenas dando **dois cliques** nos arquivos:

- **`02_Iniciar_Servico.bat`**: Liga o servidor e deixa rodando de fundo.
- **`03_Parar_Servico.bat`**: **MATA O SERVIDOR IMEDIATAMENTE.** Corta a comunicação na porta 5000. Ideal para quando você quiser usar o `npm run setup` no VS Code sem tomar erro de banco de dados reescrito!
- **`04_Reiniciar_Servico.bat`**: Desliga e liga rápido. Útil caso você edite alguma linha de código na API ou limpe o SQLite.
- **`05_Remover_Servico.bat`**: Deleta o serviço definitivamente do seu Windows (você voltará a ter que abrir o terminal do VS Code sempre).

## ⚠️ Sobre o `npm run setup`
O auto-save funciona diferente com o serviço rodando invisível!
Se você for rodar `npm run setup` para limpar tudo e reimportar o Excel:

1. Dê dois cliques no **`03_Parar_Servico.bat`** primeiro.
2. Aguarde a mensagem "Servidor desligado".
3. Vá no VS Code e faça seu `npm run setup` livremente.
4. Quando terminar de importar o excel, dê dois cliques no **`02_Iniciar_Servico.bat`** para ligar o servidor de volta!
