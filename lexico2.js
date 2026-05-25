const fs = require('fs');

function analisarLexico(caminhoArquivo) {
    const reservadas = ['if', 'bool', 'while', 'for', 'string', 'float', 'int'];
    const operadores = ['/', '+', '-', '*', '>', '<', '!', '&', '|', '='];
    const separadores = ['{', '}', '(', ')', ';', ' ', '\n', '\t'];
    const esp_separadores = [' ', '\n', '\t'];

    let token = "";
    let linha = 1;
    let coluna = 0;
    let tamanhoToken = 0;
    let pivo = 0;
    let codigo = 0;

    let listaTokens = [];
    let listaErros = [];

    // Função modificada para alimentar a lista do sintático
    function registrar(texto, classe, customCol = null) {
        if (texto === "" || esp_separadores.includes(texto)) return;
        
        codigo++;
        let posCol = customCol !== null ? customCol : pivo;
        
        if (classe.includes("ERRO")) {
            listaErros.push({
                status: "ERRO_LEXICO",
                mensagem: `Erro Léxico: ${classe} '${texto}'`,
                linha: linha,
                coluna: posCol
            });
        } else {
            listaTokens.push({
                id: codigo,
                lexema: texto,
                classe: classe,
                linha: linha,
                coluna: posCol
            });
        }
    }

    function descobrirClasse(t) {
        if (reservadas.includes(t)) return "Palavra reservada";

        const regexNumeral = /^-?[0-9]+(\.[0-9]+)?[fFLdD]?$/;
        if (regexNumeral.test(t)) return "Numeral";

        if (operadores.includes(t)) return "Operador";
        if (separadores.includes(t)) return "Separador";

        const regexIdentificador = /^[a-zA-Z_][a-zA-Z0-9_]*$/;
        if (regexIdentificador.test(t)) return "Identificador";

        return "ERRO LÉXICO (Token Inválido)";
    }

    try {
        const arq = fs.readFileSync(caminhoArquivo, 'utf8');

        for (let batedor = 0; batedor < arq.length; batedor++) {
            let leitor = arq[batedor];

            if (leitor === '/' && arq[batedor + 1] === '/') {
                while (batedor < arq.length && arq[batedor] !== '\n') {
                    batedor++;
                }
                if (arq[batedor] === '\n') {
                    linha++;
                    coluna = 0;
                }
                continue;
            }

            if (leitor === '/' && arq[batedor + 1] === '*') {
                batedor += 2;
                while (batedor < arq.length - 1 && !(arq[batedor] === '*' && arq[batedor + 1] === '/')) {
                    if (arq[batedor] === '\n') {
                        linha++;
                        coluna = 0;
                    } else {
                        coluna++;
                    }
                    batedor++;
                }
                batedor += 1; 
                continue;
            }

            if (leitor === '"') {
                pivo = coluna + 1;
                let lit = "";
                batedor++; 
                coluna++; 

                while (batedor < arq.length && arq[batedor] !== '"' && arq[batedor] !== '\n') {
                    lit += arq[batedor];
                    batedor++;
                    coluna++;
                }

                if (arq[batedor] === '"') {
                    registrar(lit, "Literal");
                    coluna++; 
                } else {
                    registrar(lit, "ERRO! STRING NÃO FECHADA");
                    if (arq[batedor] === '\n') {
                        batedor--; 
                    }
                }
                continue; 
            }

            if (separadores.includes(leitor) || operadores.includes(leitor)) {
                if (tamanhoToken > 0) {
                    registrar(token, descobrirClasse(token));
                    token = "";
                    tamanhoToken = 0;
                }

                if (!esp_separadores.includes(leitor)) {
                    let proximo = arq[batedor + 1];

                    if (leitor === '+' && proximo === '+') { registrar("++", "Operador", coluna + 1); batedor++; coluna++; } 
                    else if (leitor === '=' && proximo === '=') { registrar("==", "Operador", coluna + 1); batedor++; coluna++; }
                    else if (leitor === '-' && proximo === '-') { registrar("--", "Operador", coluna + 1); batedor++; coluna++; }
                    else if (leitor === '&' && proximo === '&') { registrar("&&", "Operador", coluna + 1); batedor++; coluna++; }
                    else if (leitor === '<' && proximo === '=') { registrar("<=", "Operador", coluna + 1); batedor++; coluna++; }
                    else if (leitor === '>' && proximo === '=') { registrar(">=", "Operador", coluna + 1); batedor++; coluna++; }
                    else if (leitor === '|' && proximo === '|') { registrar("||", "Operador", coluna + 1); batedor++; coluna++; }
                    else {
                        registrar(leitor, descobrirClasse(leitor), coluna + 1);
                    }
                }

                if (leitor === '\n') {
                    linha++;
                    coluna = 0;
                } else { 
                    coluna++;
                }

            } else {
                if (tamanhoToken === 0) {
                    pivo = coluna + 1;
                }
                token += leitor;
                tamanhoToken++;
                coluna++;
            }
        }

        if (token !== "") registrar(token, descobrirClasse(token));

        // --- RETORNO CONFIGURADO PARA O SINTÁTICO ---
        if (listaErros.length > 0) {
            return { sucesso: false, erro: listaErros[0] };
        } else {
            registrar('$', 'EOF', coluna + 1);
            return { sucesso: true, tokens: listaTokens };
        }

    } catch (err) {
        return { 
            sucesso: false, 
            erro: { status: "ERRO_SISTEMA", mensagem: err.message, linha: linha, coluna: coluna } 
        };
    }
}

module.exports = { analisarLexico };