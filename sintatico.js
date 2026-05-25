/**
 * -----------------------------------------------------------------------------
 * UNIVERSIDADE FEDERAL DE SÃO JOÃO DEL-REI
 * DISCIPLINA: Compiladores - Prof. Flávio
 * TRABALHO: Implementação de Analisador Sintático 
 * AUTOR: Vinicius Gonçalves Ribeiro de Assis
 * DATA: 25 de Maio de 2026
 * * DESCRIÇÃO:
 * Este software realiza a análise sintática de uma linguagem fictícia,
 * processando a saída do analisador léxico e tendo como resultado sucesso ou
 * imprimindo os erros encontrados. Implementa através de recursão, com uma 
 * Gramática Livre de Contexto.
 * -----------------------------------------------------------------------------
 */

function analisarSintatico(listaTokens) {
    let index = 0;
    let token_atual = listaTokens[index];
    let listaErros = []; 

    function prox_token() {
        if (index < listaTokens.length - 1) {
            index++;
            token_atual = listaTokens[index];
        }
    }

    // Função pare registrar os erros encontrados, sem parar a análise sintática
    function registrarErro(mensagemEsperada) {
        listaErros.push({
            status: "ERRO",
            mensagem: `Erro Sintático: ${mensagemEsperada}. Encontrado '${token_atual.lexema}' (${token_atual.classe})`,
            linha: token_atual.linha,
            coluna: token_atual.coluna
        });
        
    }

    // função de sicronismo, para parar de descartar a entrada ao encontrar um token de sincronismo
    function sincronizar() {
        while (token_atual.lexema !== ';' && token_atual.lexema !== '}' && token_atual.lexema !== '$') {
            prox_token();
        }
        if (token_atual.lexema === ';' || token_atual.lexema === '}') {
            prox_token();
        }
    }

    // <bloco> ::= <comando> <bloco> | ε
    function bloco() {
        while (token_atual.lexema !== '}' && token_atual.lexema !== '$') {
            try {
                comando();
            } catch (e) {
                sincronizar();
            }
        }
    }

    // <comando> ::= <atribuicao> | <declaracao> | <condicao> | <expressao_logica> | <repeticao>
    function comando() {
        const tiposValidos = ['int', 'float', 'bool', 'string'];
        
        if (tiposValidos.includes(token_atual.lexema)) {
            declaracao();
        }
        else if (token_atual.classe === 'Identificador') {
            atribuicao();
        }
        else if (token_atual.lexema === 'if') {
            condicao();
        }
        else if (token_atual.lexema === 'while') {
            repeticao();
        }
        else {
            expressao_logica(); 
            if (token_atual.lexema === ';') {
                prox_token();
            } else {
                registrarErro("Esperado ';' após a expressão");
                sincronizar();
            }
        }
    }

    // <declaracao> ::= <tipo> identificador ';'
    function declaracao() {
        tipo(); 
        
        if (token_atual.classe === 'Identificador') {
            prox_token(); 
            if (token_atual.lexema === ';') {
                prox_token(); 
            } else {
                registrarErro("Esperado ';' no final da declaração");
                throw "ErroRecuperavel"; 
            }
        } else {
            registrarErro("Esperado um identificador após o tipo");
            throw "ErroRecuperavel";
        }
    }

    function tipo() {
        const tiposValidos = ['int', 'float', 'bool', 'string'];
        if (tiposValidos.includes(token_atual.lexema)) {
            prox_token(); 
        } else {
            registrarErro("Tipo de dado inválido");
            throw "ErroRecuperavel";
        }
    }

    // <atribuicao> ::= identificador '=' <expressao_logica> ';'
    function atribuicao() {
        if (token_atual.classe === 'Identificador') {
            prox_token(); 
            
            if (token_atual.lexema === '=') {
                prox_token(); 
                expressao_logica(); 
                
                if (token_atual.lexema === ';') {
                    prox_token(); 
                    return;
                } else {
                    registrarErro("Esperado ';' no final da atribuição");
                    sincronizar();
                }
            } else {
                registrarErro("Esperado '=' após o identificador");
                throw "ErroRecuperavel";
            }
        }
    }

    // <condicao> ::= 'if' '(' <expressao_logica> ')' '{' <bloco> '}'
    function condicao() {
        if (token_atual.lexema === 'if') {
            prox_token(); 
            
            if (token_atual.lexema === '(') {
                prox_token(); 
                expressao_logica(); 
                
                if (token_atual.lexema === ')') {
                    prox_token(); 
                } else {
                    registrarErro("Esperado ')' após a expressão do IF");
                    if (token_atual.lexema !== '{') throw "ErroRecuperavel";
                }
                
                if (token_atual.lexema === '{') {
                    prox_token(); 
                    bloco(); 
                    
                    if (token_atual.lexema === '}') {
                        prox_token(); 
                        return;
                    } else {
                        registrarErro("Esperado '}' para fechar o bloco do IF");
                        throw "ErroRecuperavel";
                    }
                } else {
                    registrarErro("Esperado '{' para iniciar o bloco do IF");
                    throw "ErroRecuperavel";
                }
            } else {
                registrarErro("Esperado '(' antes da expressão do IF");
                throw "ErroRecuperavel";
            }
        }
    }

    // <repeticao> ::= 'while' '(' <expressao_logica> ')' '{' <bloco> '}'
    function repeticao() {
        if (token_atual.lexema === 'while') {
            prox_token(); 
            if (token_atual.lexema === '(') {
                prox_token(); 
                expressao_logica(); 
                
                if (token_atual.lexema === ')') {
                    prox_token(); 
                } else {
                    registrarErro("Falta fechar parênteses ')' após a condição do while");
                    if (token_atual.lexema !== '{') throw "ErroRecuperavel";
                }
                
                if (token_atual.lexema === '{') {
                    prox_token(); 
                    bloco(); 
                    if (token_atual.lexema === '}') {
                        prox_token(); 
                        return;
                    } else {
                        registrarErro("Falta fechar chaves '}' no bloco do while");
                        throw "ErroRecuperavel";
                    }
                } else {
                    registrarErro("Falta abrir chaves '{' no bloco do while");
                    throw "ErroRecuperavel";
                }
            } else {
                registrarErro("Falta abrir parênteses '(' antes da condição do while");
                throw "ErroRecuperavel";
            }
        }
    }

    // Aqui temos funções específicas para lidar com expressões lógicas, de comparação ou artiméticas 

    function expressao_logica() {
        exp_relacional(); 
        while (token_atual.lexema === '&&' || token_atual.lexema === '||') {
            prox_token(); 
            exp_relacional(); 
        }
    }

    function exp_relacional() {
        expressao_aritmetica(); 
        const operadoresRelacionais = ['>', '<', '==', '!='];
        if (operadoresRelacionais.includes(token_atual.lexema)) {
            prox_token(); 
            expressao_aritmetica(); 
        }
    }

    function expressao_aritmetica() {
        termo(); 
        while (token_atual.lexema === '+' || token_atual.lexema === '-') {
            prox_token(); 
            termo();      
        }
    }

    function termo() {
        fator(); 
        while (token_atual.lexema === '*' || token_atual.lexema === '/') {
            prox_token(); 
            fator();      
        }
    }

    function fator() {
        const classesAtomicas = ['Identificador', 'Numeral', 'Literal'];
        
        if (classesAtomicas.includes(token_atual.classe)) {
            prox_token(); 
            return;
        }
        else if (token_atual.lexema === '(') {
            prox_token(); 
            expressao_logica(); 
            if (token_atual.lexema === ')') {
                prox_token(); 
                return;
            } else {
                registrarErro("Esperado ')' para fechar a expressão");
                throw "ErroRecuperavel";
            }
        }
        else {
            registrarErro("Fator inválido: esperado identificador, numeral, string ou '('");
            throw "ErroRecuperavel";
        }
    }

    try {
        bloco();

        if (listaErros.length > 0) {
            return {
                status: "ERRO",
                erros: listaErros
            };
        }

        if (token_atual.lexema === '$') {
            return {
                status: "SUCESSO",
                mensagem: "Código sintaticamente correto!"
            };
        } else {
            registrarErro("Tokens extras encontrados após o fim esperado do programa");
            return { status: "ERRO", erros: listaErros };
        }

    } catch (e) {
        return {
            status: "ERRO",
            mensagem: "Compilação interrompida devido a múltiplos erros críticos.",
            erros: listaErros
        };
    }
}

module.exports = { analisarSintatico };