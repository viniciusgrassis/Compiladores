/**
 * -----------------------------------------------------------------------------
 * UNIVERSIDADE FEDERAL DE SÃO JOÃO DEL-REI
 * DISCIPLINA: Compiladores - Prof. Flávio
 * TRABALHO: Implementação de Analisador Sintático + Analisador Semântico
 * AUTOR: Vinicius Gonçalves Ribeiro de Assis
 * -----------------------------------------------------------------------------
 */

/*  Novo código atualizado mantém toda a estrutura original do sintático 
    além de adicionar checagem de tipos e de declaração e uso de variáveis
    que é a parte semântica. */ 

function analisarSintatico(listaTokens) {
    let index = 0;
    let token_atual = listaTokens[index];
    let listaErros = []; 

    /* Nova variável que é uma pilha de objetos. Cada objeto é um escopo,
       que guarda o nome das variáveis e o tipo delas. O primeiro é o global,
       depois, cada vez que entra num novo bloco ele faz "push" e quando sai,
       ele faz pop, ou seja, as variáveis de um escopo só existem dentro dele */

    let pilhaEscopos = [{}]; 

    function prox_token() {
        if (index < listaTokens.length - 1) {
            index++;
            token_atual = listaTokens[index];
        }
    }

    // Função de registrar erros sintáticos
    function registrarErro(mensagemEsperada) {
        listaErros.push({
            status: "ERRO",
            mensagem: `Erro Sintático: ${mensagemEsperada}. Encontrado '${token_atual.lexema}' (${token_atual.classe})`,
            linha: token_atual.linha,
            coluna: token_atual.coluna
        });
    }

    // Função de registrar erros semânticos
    function registrarErroSemantico(mensagem) {
        listaErros.push({
            status: "ERRO",
            mensagem: `Erro Semântico: ${mensagem}`,
            linha: token_atual.linha,
            coluna: token_atual.coluna
        });
    }

    /* Função nova que recebe um novo e busca o tipo da variável. Ela funciona
       procurando do escopo mais interno para o mais externo. Ou seja, primeiro
       procura a declação no bloco atual e depois vai "subindo" até o escopo global.
       Se não for encontrada em nenhum nível, retorna null, fazendo o resto do código
       interpretar como variável não declarada */

    function buscarTipoVariavel(lexema) {
        for (let i = pilhaEscopos.length - 1; i >= 0; i--) {
            if (pilhaEscopos[i][lexema] !== undefined) {
                return pilhaEscopos[i][lexema];
            }
        }
        return null; 
    }

    /* Nova função com tabela de regras para tipos. Recebe o tipo do operando a esqueda,
       o tipo do operando a direita e operador. Retorna o tipo resultante da operação, se
       fizer sentido e erro se não fizer. 
       Soma: entre strings, retorna string. Entre int's, retorna int. Entre float's, retorna float
       e entre float e int, retorna float. Ademais, erro.
       Subtração, multiplicação e divisão. Comportamento similar, mas sem incluir strings.
       Comparação de maior / menor ou maior igual / menor igual. Só podem ser feitas entre números
       e retorna booleano.
       Comparação de igualdade ou diferença, também só com números e retorna um booleano 
       Operações lógicas só aceitam booleanos */
    function verificarTipoOperacaoBinaria(tipoEsq, op, tipoDir) {
        if (tipoEsq === 'erro' || tipoDir === 'erro') return 'erro';

        if (op === '+') {
            if (tipoEsq === 'string' || tipoDir === 'string') return 'string'; 
            if (tipoEsq === 'int' && tipoDir === 'int') return 'int';
            if (tipoEsq === 'float' && tipoDir === 'float') return 'float';
            if ((tipoEsq === 'int' && tipoDir === 'float') || (tipoEsq === 'float' && tipoDir === 'int')) return 'float'; 
            return 'erro';
        }

        if (['-', '*', '/'].includes(op)) {
            if (tipoEsq === 'int' && tipoDir === 'int') return 'int';
            if (tipoEsq === 'float' && tipoDir === 'float') return 'float';
            if ((tipoEsq === 'int' && tipoDir === 'float') || (tipoEsq === 'float' && tipoDir === 'int')) return 'float';
            return 'erro'; 
        }

        if (['>', '<', '>=', '<='].includes(op)) {
            let num = ['int', 'float'];
            if (num.includes(tipoEsq) && num.includes(tipoDir)) return 'bool';
            return 'erro';
        }

        if (['==', '!='].includes(op)) {
            if (tipoEsq === tipoDir) return 'bool';
            let num = ['int', 'float'];
            if (num.includes(tipoEsq) && num.includes(tipoDir)) return 'bool';
            return 'erro';
        }

        if (['&&', '||'].includes(op)) {
            if (tipoEsq === 'bool' && tipoDir === 'bool') return 'bool';
            return 'erro';
        }

        return 'erro';
    }

    // Função de sincronismo
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
    // <declaracao> ::= <tipo> identificador (';' | '=' <expressao_logica> ';')
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
        // Novo else if para suportar blocos aninhados
        else if (token_atual.lexema === '{') {
            prox_token();
            pilhaEscopos.push({}); // Empilha escopo interno local
            bloco();
            if (token_atual.lexema === '}') {
                prox_token();
                pilhaEscopos.pop(); // Desempilha escopo interno local
            } else {
                registrarErro("Esperado '}' para fechar o bloco");
                pilhaEscopos.pop(); // Desempilha mesmo em caso de erro, para não deixar a pilha desbalanceada
                throw "ErroRecuperavel"; // Garante que sincronizar() seja chamado e a análise não entre em loop
            }
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

    // <declaracao> ::= <tipo> identificador (';' | '=' <expressao_logica> ';')
    /* Agora a função de declaração guarda o tipo declarado antes de consumir o
       token, verifica se o identificador já existe no escopo atual e se sim, 
       acusa erro de variável já declarada. Se não, registra a variável no 
       escopo atual junto com o tipo dela. */ 
    function declaracao() {
        let tipoDeclarado = token_atual.lexema; 
        tipo(); 
        
        if (token_atual.classe === 'Identificador') {
            let nomeVar = token_atual.lexema;
            let escopoAtual = pilhaEscopos[pilhaEscopos.length - 1];

            if (escopoAtual && escopoAtual[nomeVar] !== undefined) {
                registrarErroSemantico(`Variável '${nomeVar}' já declarada neste escopo.`);
            } else if (escopoAtual) {
                escopoAtual[nomeVar] = tipoDeclarado; 
            }

            prox_token(); 

            if (token_atual.lexema === '=') {
                prox_token(); 
                let tipoExpressao = expressao_logica();

                if (tipoExpressao !== 'erro') {
                    if (tipoDeclarado === 'float' && tipoExpressao === 'int') {
                        // Coerção numérica aceita
                    } else if (tipoDeclarado !== tipoExpressao) {
                        registrarErroSemantico(`Tipo inválido na inicialização. Não é possível atribuir '${tipoExpressao}' a '${tipoDeclarado}'.`);
                    }
                }
            }

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
    /* Agora ela procura o tipo de variável no lado esquerdo. Se não encontrar, gera erro
       pega o tipo retornado do lado direito e compara ambos. Se forem diferentes, retorna erro,
       com exceção de float = int, no qual aceita como coerção válida, que é atribuir um int a uma
       variável float. */
    function atribuicao() {
        if (token_atual.classe === 'Identificador') {
            let nomeVar = token_atual.lexema;
            let tipoVar = buscarTipoVariavel(nomeVar);

            if (tipoVar === null) {
                registrarErroSemantico(`Variável '${nomeVar}' não foi declarada.`);
                tipoVar = 'erro';
            }

            prox_token(); 
            
            if (token_atual.lexema === '=') {
                prox_token(); 
                let tipoExpressao = expressao_logica(); 
                
                if (tipoVar !== 'erro' && tipoExpressao !== 'erro') {
                    if (tipoVar === 'float' && tipoExpressao === 'int') {
                        // Coerção numérica aceita
                    } else if (tipoVar !== tipoExpressao) {
                        registrarErroSemantico(`Tipo inválido na atribuição. Não é possível atribuir '${tipoExpressao}' a '${tipoVar}'.`);
                    }
                }

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
    /* Agora a condição dentro de parenteses precisa ser do tipo bool. Int também
       é aceito silenciosamente como bool. Caso seja algum tipo diferente, gera
       um erro semântico. E agora, tanto o bloco if, quanto o bloco else desempilham
       seu próprio escopo */
    function condicao() {
        if (token_atual.lexema === 'if') {
            prox_token(); 
                if (token_atual.lexema === '(') {
                    prox_token(); 
                    let tipoCond = expressao_logica(); 
                    if (tipoCond === 'int') tipoCond = 'bool';
                    if (tipoCond !== 'bool' && tipoCond !== 'erro') {
                        registrarErroSemantico(`A condição do 'if' deve ser do tipo 'bool'. Encontrado: '${tipoCond}'.`);
                    }
                    if (token_atual.lexema === ')') { prox_token(); } else { registrarErro("Esperado ')'"); }

                    if (token_atual.lexema === '{') {
                        prox_token();
                        pilhaEscopos.push({});
                        bloco(); 
                        if (token_atual.lexema === '}') {
                            prox_token(); 
                            pilhaEscopos.pop();

                            if (token_atual.lexema === 'else') {
                                prox_token();
                                if (token_atual.lexema === '{') {
                                    prox_token();
                                    pilhaEscopos.push({});
                                    bloco();
                                    if (token_atual.lexema === '}') {
                                        prox_token();
                                        pilhaEscopos.pop();
                                    } else { registrarErro("Esperado '}' para fechar o bloco do ELSE"); pilhaEscopos.pop(); throw "ErroRecuperavel"; }
                                } else { registrarErro("Esperado '{' para iniciar o bloco do ELSE"); }
                            }
                            return;
                        } else { registrarErro("Esperado '}'"); pilhaEscopos.pop(); throw "ErroRecuperavel"; }
                    } else { registrarErro("Esperado '{'"); throw "ErroRecuperavel"; }
                }
        }
    }

    // <repeticao> ::= 'while' '(' <expressao_logica> ')' '{' <bloco> '}'
    // funcionamento similar ao dos blocos de condição
    function repeticao() {
        if (token_atual.lexema === 'while') {
            prox_token(); 
            if (token_atual.lexema === '(') {
                prox_token(); 
                let tipoCond = expressao_logica(); 
                
                if (tipoCond === 'int') {
                    tipoCond = 'bool';
                } else if (tipoCond !== 'bool' && tipoCond !== 'erro') {
                    registrarErroSemantico(`A condição do 'while' deve ser do tipo 'bool'. Encontrado: '${tipoCond}'.`);
                }

                if (token_atual.lexema === ')') {
                    prox_token(); 
                } else {
                    registrarErro("Falta fechar parênteses ')' após a condição do while");
                    if (token_atual.lexema !== '{') throw "ErroRecuperavel";
                }
                
                if (token_atual.lexema === '{') {
                    prox_token();
                    pilhaEscopos.push({}); // Abre escopo do WHILE
                    bloco(); 
                    if (token_atual.lexema === '}') {
                        prox_token(); 
                        pilhaEscopos.pop(); // Fecha escopo do WHILE
                        return;
                    } else {
                        registrarErro("Falta fechar chaves '}' no bloco do while");
                        pilhaEscopos.pop();
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

    // Funções de expressão agora não só consomem, mas também retornam um tipo

    /* A função fator, que é a base, agora vê se o token é identificador. Se sim,
       ele busca o tipo na tabela e lança erro se não encontrar. Se for numeral, retorna
       int ou float a depender do token ter '.' ou não. Se for literal, retorna string. E 
       pode retornar bool também. Se for uma subexpressão, retorna o tipo resultante dela. 
       As outras funções funcionam de maneira similar: pegam o tipo do primeiro, o operador
       e o tipo do segundo. Aí chamam a função verificadora de tipo para calcular o resultante.
       O tipo final acumulado é retornado para função que chamou. */


    function expressao_logica() {
        let tipoEsq = exp_relacional(); 
        while (token_atual.lexema === '&&' || token_atual.lexema === '||') {
            let op = token_atual.lexema;
            prox_token(); 
            let tipoDir = exp_relacional(); 
            tipoEsq = verificarTipoOperacaoBinaria(tipoEsq, op, tipoDir);
            if (tipoEsq === 'erro') {
                registrarErroSemantico(`Operação lógica '${op}' inválida.`);
            }
        }
        return tipoEsq;
    }

    function exp_relacional() {
        let tipoEsq = expressao_aritmetica(); 
        const operadoresRelacionais = ['>', '<', '==', '!=', '<=', '>='];
        if (operadoresRelacionais.includes(token_atual.lexema)) {
            let op = token_atual.lexema;
            prox_token(); 
            let tipoDir = expressao_aritmetica(); 
            tipoEsq = verificarTipoOperacaoBinaria(tipoEsq, op, tipoDir);
            if (tipoEsq === 'erro') {
                registrarErroSemantico(`Comparação '${op}' inválida.`);
            }
        }
        return tipoEsq;
    }

    function expressao_aritmetica() {
        let tipoEsq = termo(); 
        while (token_atual.lexema === '+' || token_atual.lexema === '-') {
            let op = token_atual.lexema;
            prox_token(); 
            let tipoDir = termo();      
            tipoEsq = verificarTipoOperacaoBinaria(tipoEsq, op, tipoDir);
            if (tipoEsq === 'erro') {
                registrarErroSemantico(`Operação matemática '${op}' inválida.`);
            }
        }
        return tipoEsq;
    }

    function termo() {
        let tipoEsq = fator(); 
        while (token_atual.lexema === '*' || token_atual.lexema === '/') {
            let op = token_atual.lexema;
            prox_token(); 
            let tipoDir = fator();      
            tipoEsq = verificarTipoOperacaoBinaria(tipoEsq, op, tipoDir);
            if (tipoEsq === 'erro') {
                registrarErroSemantico(`Operação matemática '${op}' inválida.`);
            }
        }
        return tipoEsq;
    }


    function fator() {
        const classesAtomicas = ['Identificador', 'Numeral', 'Literal', 'Booleano'];
        
        if (classesAtomicas.includes(token_atual.classe)) {
            let classeToken = token_atual.classe;
            let lexemaToken = token_atual.lexema;
            prox_token(); 
            
            if (classeToken === 'Identificador') {
                let tipo = buscarTipoVariavel(lexemaToken);
                if (tipo === null) {
                    registrarErroSemantico(`Variável '${lexemaToken}' não foi declarada.`);
                    return 'erro';
                }
                return tipo;
            }
            if (classeToken === 'Numeral') {
                return lexemaToken.includes('.') ? 'float' : 'int';
            }
            if (classeToken === 'Literal') {
                return 'string';
            }
            if (classeToken === 'Booleano') {
                return 'bool';
            }
        }
        else if (token_atual.lexema === '(') {
            prox_token(); 
            let tipoSub = expressao_logica(); 
            if (token_atual.lexema === ')') {
                prox_token(); 
                return tipoSub;
            } else {
                registrarErro("Esperado ')' para fechar a expressão");
                throw "ErroRecuperavel";
            }
        }
        else {
            registrarErro(`Fator inválido: esperado identificador, numeral, string ou '('. Encontrado '${token_atual.lexema}'`);
            throw "ErroRecuperavel";
        }
    }

    // coração da execução do parser
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
                mensagem: "Código sintática e semanticamente correto!"
            };
        } else {
            registrarErro("Tokens extras encontrados após o fim esperado do programa");
            return { status: "ERRO", erros: listaErros };
        }

    } catch (e) {
        return {
            status: "ERRO",
            mensagem: "Compilação interrompida devido a falha inesperada.",
            erros: listaErros
        };
    }
}

module.exports = { analisarSintatico };