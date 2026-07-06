/**
 * -----------------------------------------------------------------------------
 * UNIVERSIDADE FEDERAL DE SÃO JOÃO DEL-REI
 * DISCIPLINA: Compiladores - Prof. Flávio
 * TRABALHO: Implementation de Analisador Sintático + Semântico + Geração de Código
 * AUTOR: Vinicius Gonçalves Ribeiro de Assis
 * -----------------------------------------------------------------------------
 */

function analisarSintatico(listaTokens) {
    let index = 0;
    let token_atual = listaTokens[index];
    let listaErros = []; 

    let poolEscopos = [{}]; 

    // Tabela global de variáveis: acumula TODAS as declarações para gerar o .data no final
    // Como sombra é proibido, cada nome é único e não há conflito
    let tabelaGlobal = {};

    // Contadores para temporárias ($t0, $t1...) e rótulos
    let contTemporarias = 0;
    let contRotulos = 0;

    // Registradores de uso geral no estilo MIPS: $s0, $s1, $s2
    const R1 = '$s0', R2 = '$s1', R3 = '$s2';

    function novaTemporaria() {
        let nome = `$t${contTemporarias++}`;
        tabelaGlobal[nome] = 'temp'; // registra temporária no .data também
        return nome;
    }

    function novoRotulo(prefixo = "L") {
        return `${prefixo}${contRotulos++}`;
    }

    // Buffer que acumula as instruções do .text durante a análise
    let bufferTexto = [];

    function emitir(instrucao) {
        bufferTexto.push(instrucao);
    }

    function prox_token() {
        if (index < listaTokens.length - 1) {
            index++;
            token_atual = listaTokens[index];
        }
    }

    function registrarErro(mensagemEsperada) {
        listaErros.push({
            status: "ERRO",
            mensagem: `Erro Sintático: ${mensagemEsperada}. Encontrado '${token_atual.lexema}' (${token_atual.classe})`,
            linha: token_atual.linha,
            coluna: token_atual.coluna
        });
    }

    function registrarErroSemantico(mensagem) {
        listaErros.push({
            status: "ERRO",
            mensagem: `Erro Semântico: ${mensagem}`,
            linha: token_atual.linha,
            coluna: token_atual.coluna
        });
    }

    /* Busca o tipo de uma variável percorrendo a pilha do escopo mais interno
       para o mais externo. */
    function buscarTipoVariavel(lexema) {
        for (let i = poolEscopos.length - 1; i >= 0; i--) {
            if (poolEscopos[i][lexema] !== undefined) {
                return poolEscopos[i][lexema];
            }
        }
        return null; 
    }

    /* Verifica se o nome já existe em QUALQUER escopo da pilha.
       Usado em declaracao() para proibir sombra de variável globalmente. */
    function existeEmQualquerEscopo(lexema) {
        for (let i = 0; i < poolEscopos.length; i++) {
            if (poolEscopos[i][lexema] !== undefined) return true;
        }
        return false;
    }

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

    function sincronizar() {
        while (token_atual.lexema !== ';' && token_atual.lexema !== '}' && token_atual.lexema !== '$') {
            prox_token();
        }
        if (token_atual.lexema === ';' || token_atual.lexema === '}') {
            prox_token();
        }
    }

    function bloco() {
        while (token_atual.lexema !== '}' && token_atual.lexema !== '$') {
            try {
                comando();
            } catch (e) {
                sincronizar();
            }
        }
    }

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
        else if (token_atual.lexema === '{') {
            prox_token();
            poolEscopos.push({}); 
            bloco();
            if (token_atual.lexema === '}') {
                prox_token();
                poolEscopos.pop(); 
            } else {
                registrarErro("Esperado '}' para fechar o bloco");
                poolEscopos.pop(); 
                throw "ErroRecuperavel"; 
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

    function declaracao() {
        let tipoDeclarado = token_atual.lexema; 
        tipo(); 
        
        if (token_atual.classe === 'Identificador') {
            let nomeVar = token_atual.lexema;
            let escopoAtual = poolEscopos[poolEscopos.length - 1];

            if (existeEmQualquerEscopo(nomeVar)) {
                registrarErroSemantico(`Variável '${nomeVar}' já declarada. Shadowing não é permitido.`);
            } else {
                escopoAtual[nomeVar] = tipoDeclarado;
                tabelaGlobal[nomeVar] = tipoDeclarado; 
            }

            prox_token(); 

            if (token_atual.lexema === '=') {
                prox_token(); 
                let objExpressao = expressao_logica();

                if (objExpressao.tipo !== 'erro') {
                    if (tipoDeclarado === 'float' && objExpressao.tipo === 'int') {
                        // Coerção aceita
                    } else if (tipoDeclarado !== objExpressao.tipo) {
                        registrarErroSemantico(`Tipo inválido na inicialização. Não é possível atribuir '${objExpressao.tipo}' a '${tipoDeclarado}'.`);
                    }

                    emitir(`lw  ${R1}, ${objExpressao.resultado}`);
                    emitir(`sw  ${nomeVar}, ${R1}`);
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
                let objExpressao = expressao_logica(); 
                
                if (tipoVar !== 'erro' && objExpressao.tipo !== 'erro') {
                    if (tipoVar === 'float' && objExpressao.tipo === 'int') {
                        // Coerção aceita
                    } else if (tipoVar !== objExpressao.tipo) {
                        registrarErroSemantico(`Tipo inválido na atribuição. Não é possível atribuir '${objExpressao.tipo}' a '${tipoVar}'.`);
                    }

                    emitir(`lw  ${R1}, ${objExpressao.resultado}`);
                    emitir(`sw  ${nomeVar}, ${R1}`);
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

    function condicao() {
        if (token_atual.lexema === 'if') {
            prox_token(); 
            if (token_atual.lexema === '(') {
                prox_token(); 
                
                let labelElse = novoRotulo("ELSE");
                let labelEnd  = novoRotulo("IF_FIM");

                // Passa o rótulo de escape diretamente para a expressão lógica
                let objCond = expressao_logica(labelElse); 
                
                if (objCond.tipo === 'int') objCond.tipo = 'bool';
                if (objCond.tipo !== 'bool' && objCond.tipo !== 'erro') {
                    registrarErroSemantico(`A condição do 'if' deve ser do tipo 'bool'. Encontrado: '${objCond.tipo}'.`);
                }
                if (token_atual.lexema === ')') { prox_token(); } else { registrarErro("Esperado ')'"); }

                // Se a condição avaliada não emitiu o branch curto 
                if (objCond.resultado !== R1) {
                    emitir(`lw  ${R1}, ${objCond.resultado}`);
                    emitir(`beq ${R1}, 0, ${labelElse}`);
                }

                if (token_atual.lexema === '{') {
                    prox_token();
                    poolEscopos.push({});
                    bloco(); 
                    if (token_atual.lexema === '}') {
                        prox_token(); 
                        poolEscopos.pop();

                        emitir(`j   ${labelEnd}`);
                        emitir('');
                        emitir(`${labelElse}:`);

                        if (token_atual.lexema === 'else') {
                            prox_token();
                            if (token_atual.lexema === '{') {
                                prox_token();
                                poolEscopos.push({}); 
                                bloco();
                                if (token_atual.lexema === '}') {
                                    prox_token();
                                    poolEscopos.pop();
                                } else { registrarErro("Esperado '}' para fechar o bloco do ELSE"); poolEscopos.pop(); throw "ErroRecuperavel"; }
                            } else { registrarErro("Esperado '{' para iniciar o bloco do ELSE"); }
                        }

                        emitir('');
                        emitir(`${labelEnd}:`);
                        return;
                    } else { registrarErro("Esperado '}'"); poolEscopos.pop(); throw "ErroRecuperavel"; }
                } else { registrarErro("Esperado '{'"); throw "ErroRecuperavel"; }
            }
        }
    }

    function repeticao() {
        if (token_atual.lexema === 'while') {
            prox_token(); 
            if (token_atual.lexema === '(') {
                prox_token(); 

                let labelStart = novoRotulo("WHILE");
                let labelEnd   = novoRotulo("WHILE_FIM");

                emitir('');
                emitir(`${labelStart}:`);

                // Passa o rótulo de escape para o fim do laço
                let objCond = expressao_logica(labelEnd); 

                if (objCond.tipo === 'int') {
                    objCond.tipo = 'bool';
                } else if (objCond.tipo !== 'bool' && objCond.tipo !== 'erro') {
                    registrarErroSemantico(`A condição do 'while' deve ser do tipo 'bool'. Encontrado: '${objCond.tipo}'.`);
                }

                if (token_atual.lexema === ')') {
                    prox_token(); 
                } else {
                    registrarErro("Falta fechar parênteses ')' após a condição do while");
                    if (token_atual.lexema !== '{') throw "ErroRecuperavel";
                }

                // Se não gerou o branch curto direto, faz a verificação explícita
                if (objCond.resultado !== R1) {
                    emitir(`lw  ${R1}, ${objCond.resultado}`);
                    emitir(`beq ${R1}, 0, ${labelEnd}`);
                }
                
                if (token_atual.lexema === '{') {
                    prox_token();
                    poolEscopos.push({}); 
                    bloco(); 
                    if (token_atual.lexema === '}') {
                        prox_token(); 
                        poolEscopos.pop(); 
                        emitir(`j   ${labelStart}`);
                        emitir('');
                        emitir(`${labelEnd}:`);
                        return;
                    } else {
                        registrarErro("Falta fechar chaves '}' no bloco do while");
                        poolEscopos.pop();
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

    function expressao_logica(labelFalso = null) {
        let objEsq = exp_relacional(labelFalso); 
        while (token_atual.lexema === '&&' || token_atual.lexema === '||') {
            let op = token_atual.lexema;
            prox_token(); 
            let objDir = exp_relacional(labelFalso); 
            let tipoResult = verificarTipoOperacaoBinaria(objEsq.tipo, op, objDir.tipo);
            
            if (tipoResult === 'erro') {
                registrarErroSemantico(`Operação lógica '${op}' inválida.`);
                objEsq = { tipo: 'erro', resultado: 'erro' };
            } else {
                let temp = novaTemporaria();
                let opAssembly = (op === '&&') ? 'and' : 'or';
                emitir(`lw  ${R1}, ${objEsq.resultado}`);
                emitir(`lw  ${R2}, ${objDir.resultado}`);
                emitir(`${opAssembly} ${R3}, ${R1}, ${R2}`);
                emitir(`sw  ${temp}, ${R3}`);
                objEsq = { tipo: tipoResult, resultado: temp };
            }
        }
        return objEsq;
    }

    function exp_relacional(labelFalso = null) {
        let objEsq = expressao_aritmetica(); 
        const operadoresRelacionais = ['>', '<', '==', '!=', '<=', '>='];
        if (operadoresRelacionais.includes(token_atual.lexema)) {
            let op = token_atual.lexema;
            prox_token(); 
            let objDir = expressao_aritmetica(); 
            let tipoResult = verificarTipoOperacaoBinaria(objEsq.tipo, op, objDir.tipo);
            
            if (tipoResult === 'erro') {
                registrarErroSemantico(`Comparação '${op}' inválida.`);
                objEsq = { tipo: 'erro', resultado: 'erro' };
            } else {
                const mapInv = { '>': 'ble', '<': 'bge', '==': 'bne', '!=': 'beq', '<=': 'bgt', '>=': 'blt' };
                const mapOps = { '>': 'bgt', '<': 'blt', '==': 'beq', '!=': 'bne', '<=': 'ble', '>=': 'bge' };

                emitir(`lw  ${R1}, ${objEsq.resultado}`);
                emitir(`lw  ${R2}, ${objDir.resultado}`);

                // Se houver rótulo falso (chamado por if/while), emite o branch inverso direto
                if (labelFalso) {
                    emitir(`${mapInv[op]} ${R1}, ${R2}, ${labelFalso}`);
                    objEsq = { tipo: tipoResult, resultado: R1 };
                } else {
                    // Atribuições ou expressões puras fora de controle de fluxo mantêm a temporária (0 ou 1)
                    let temp      = novaTemporaria();
                    let labelTrue = novoRotulo("CMP_TRUE");
                    let labelEnd  = novoRotulo("CMP_FIM");

                    emitir(`${mapOps[op]} ${R1}, ${R2}, ${labelTrue}`);
                    emitir(`li  ${R1}, 0`);
                    emitir(`j   ${labelEnd}`);
                    emitir('');
                    emitir(`${labelTrue}:`);
                    emitir(`li  ${R1}, 1`);
                    emitir('');
                    emitir(`${labelEnd}:`);
                    emitir(`sw  ${temp}, ${R1}`);
                    objEsq = { tipo: tipoResult, resultado: temp };
                }
            }
        }
        return objEsq;
    }

    function expressao_aritmetica() {
        let objEsq = termo(); 
        while (token_atual.lexema === '+' || token_atual.lexema === '-') {
            let op = token_atual.lexema;
            prox_token(); 
            let objDir = termo();      
            let tipoResult = verificarTipoOperacaoBinaria(objEsq.tipo, op, objDir.tipo);
            
            if (tipoResult === 'erro') {
                registrarErroSemantico(`Operação matemática '${op}' inválida.`);
                objEsq = { tipo: 'erro', resultado: 'erro' };
            } else {
                let temp = novaTemporaria();
                let opAssembly = (op === '+') ? 'add' : 'sub';
                emitir(`lw  ${R1}, ${objEsq.resultado}`);
                emitir(`lw  ${R2}, ${objDir.resultado}`);
                emitir(`${opAssembly} ${R3}, ${R1}, ${R2}`);
                emitir(`sw  ${temp}, ${R3}`);
                objEsq = { tipo: tipoResult, resultado: temp };
            }
        }
        return objEsq;
    }

    function termo() {
        let objEsq = factor(); 
        while (token_atual.lexema === '*' || token_atual.lexema === '/') {
            let op = token_atual.lexema;
            prox_token(); 
            let objDir = factor();      
            let tipoResult = verificarTipoOperacaoBinaria(objEsq.tipo, op, objDir.tipo);
            
            if (tipoResult === 'erro') {
                registrarErroSemantico(`Operação matemática '${op}' inválida.`);
                objEsq = { tipo: 'erro', resultado: 'erro' };
            } else {
                let temp = novaTemporaria();
                let opAssembly = (op === '*') ? 'mul' : 'div';
                emitir(`lw  ${R1}, ${objEsq.resultado}`);
                emitir(`lw  ${R2}, ${objDir.resultado}`);
                emitir(`${opAssembly} ${R3}, ${R1}, ${R2}`);
                emitir(`sw  ${temp}, ${R3}`);
                objEsq = { tipo: tipoResult, resultado: temp };
            }
        }
        return objEsq;
    }

    function factor() {
        const classesAtomicas = ['Identificador', 'Numeral', 'Literal', 'Booleano'];
        
        if (classesAtomicas.includes(token_atual.classe)) {
            let classeToken = token_atual.classe;
            let lexemaToken = token_atual.lexema;
            prox_token(); 
            
            if (classeToken === 'Identificador') {
                let tipo = buscarTipoVariavel(lexemaToken);
                if (tipo === null) {
                    registrarErroSemantico(`Variável '${lexemaToken}' não foi declarada.`);
                    return { tipo: 'erro', resultado: 'erro' };
                }
                return { tipo: tipo, resultado: lexemaToken };
            }
            if (classeToken === 'Numeral') {
                let tipo = lexemaToken.includes('.') ? 'float' : 'int';
                return { tipo: tipo, resultado: lexemaToken };
            }
            if (classeToken === 'Literal') {
                return { tipo: 'string', resultado: lexemaToken };
            }
            if (classeToken === 'Booleano') {
                let val = (lexemaToken === 'true') ? '1' : '0';
                return { tipo: 'bool', resultado: val };
            }
        }
        else if (token_atual.lexema === '(') {
            prox_token(); 
            let objSub = expressao_logica(); 
            if (token_atual.lexema === ')') {
                prox_token(); 
                return objSub;
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

    function tipoDado(tipo) {
        if (tipo === 'float') return '.float 0.0';
        if (tipo === 'string') return '.asciiz ""';
        if (tipo === 'temp') return '.word 0';
        return '.word 0'; 
    }

    function imprimirAssembly() {
        console.log('.data');
        for (const [nome, tipo] of Object.entries(tabelaGlobal)) {
            console.log(`    ${nome}: ${tipoDado(tipo)}`);
        }

        console.log('\n.text');
        for (const linha of bufferTexto) {
            console.log(linha);
        }
    }

    try {
        bloco();

        if (listaErros.length > 0) {
            return { status: "ERRO", erros: listaErros };
        }

        if (token_atual.lexema === '$') {
            imprimirAssembly();
            return { status: "SUCESSO", mensagem: "Código sintática e semanticamente correto!" };
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