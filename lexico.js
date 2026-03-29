/**
 * -----------------------------------------------------------------------------
 * UNIVERSIDADE FEDERAL DE SÃO JOÃO DEL-REI
 * DISCIPLINA: Compiladores - Prof. Flávio
 * TRABALHO: Implementação de Analisador Léxico 
 * AUTOR: Vinicius Gonçalves Ribeiro de Assis
 * DATA: 26 de Março de 2026
 * * DESCRIÇÃO:
 * Este software realiza a análise léxica de uma linguagem fictícia,
 * processando um arquivo de entrada (entrada.txt) e gerando uma tabela de tokens
 * (saida.txt). Implementa reconhecimento via Expressões Regulares (Regex) e
 * tratamento de erros para tokens inválidos e literais não finalizados.
 * -----------------------------------------------------------------------------
 */

const fs = require('fs');

// definição de elementos como palavras reservadas e operadores que o analisador vai reconhecer;

const reservadas = ['if', 'bool', 'while', 'for', 'string', 'float', 'int'];
const operadores = ['/', '+', '-', '*', '>', '<', '!', '&', '|', '='];
const separadores = ['{', '}', '(', ')', ';', ' ', '\n', '\t'];
const esp_separadores = [' ', '\n', '\t'];

// inicialização de elementos importantes

let token = "";
let linha = 1;
let coluna = 0;
let tamanhoToken = 0;
let pivo = 0;
let codigo = 0;
let saida = "Código".padEnd(8) + " | " + 
            "Token".padEnd(40) + " | " + 
            "Classe".padEnd(25) + " | " + 
            "Linha".padEnd(5) + " | " + 
            "Coluna\n";

/* Funções de suporte, aqui temos a função registrar, que recebe token e classe e adiciona na saída que será gravada no 
arquivo final. Temo descobrir classe, que como o nome diz, dado um determinado token, determina o que ele é, observando que
para seguir as regras que determinam o que um identificador pode ter ou não, é utilizado expressão regular. E por fim, 
uma função que registra os erros encontrados. */

function registrar(texto, classe, customCol = null) {
    if (texto === "" || esp_separadores.includes(texto)) return;
    
    codigo++;
    let posCol = customCol !== null ? customCol : pivo;
    saida += ` ${codigo.toString().padEnd(7)} | ${texto.padEnd(40)} | ${classe.padEnd(25)} | ${linha.toString().padEnd(5)} | ${posCol}\n`;
}

function descobrirClasse(t) {
    if (reservadas.includes(t)) return "Palavra reservada";

    const regexNumeral = /^-?[0-9]+(\.[0-9]+)?[fFLdD]?$/;
    if (regexNumeral.test(t)) return "Numeral";

    if (operadores.includes(t)) return "Operador";
    if (separadores.includes(t)) return "Separador";

    //if (t.trim() !== "" && !isNaN(t)) return "Numeral";

    const regexIdentificador = /^[a-zA-Z_][a-zA-Z0-9_]*$/;
    if (regexIdentificador.test(t)) return "Identificador";

    return "ERRO LÉXICO (Token Inválido)";
}

let erros = "RELATÓRIO DE ERROS LÉXICOS\n" + "=".repeat(30) + "\n";

function registrarErro(valor, tipo, l, c) {
    erros += `[ERRO] ${tipo}: '${valor}' encontrado na Linha ${l}, Coluna ${c}\n`;
    saida += ` ERRO    | ${valor.padEnd(40)} | ${tipo.padEnd(25)} | ${l.toString().padEnd(5)} | ${c}\n`;
}

// Lógica principal

try {
    const arq = fs.readFileSync('entrada.txt', 'utf8');

    for (let batedor = 0; batedor < arq.length; batedor++) {
        let leitor = arq[batedor];

        // Um if para lidar com comentários no formato "//"
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

        // Um if para lidar com comentários no formato "/* */"
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
            batedor += 1; //Para no '/' do final
            continue;
        }

        // Um if para o tratamento de literais
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

        // Um if específico para lidar com operadores duplos
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

            // Aqui é para atualizar quando se muda de linha
            if (leitor === '\n') {
                linha++;
                coluna = 0;
            } else { 
                coluna++;
            }

        // Aqui é onde acumula o token e vai 'andando' pelas colunas

        } else {
            if (tamanhoToken === 0) {
                pivo = coluna + 1;
            }
            token += leitor;
            tamanhoToken++;
            coluna++;
        }
    }

    // Um if no final para garantir que não ficou nenhum token restante pós o loop
    if (token !== "") registrar(token, descobrirClasse(token));

    fs.writeFileSync('saida.txt', saida);
    console.log("Arquivo 'saida.txt' gerado com sucesso.\n");

} catch (err) {
    console.error("Erro ao processar:", err);
}