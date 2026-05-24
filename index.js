// index.js
const { analisarLexico } = require('./lexico2');
const { analisarSintatico } = require('./sintatico');

console.log("Iniciando Compilação...\n");

// 1. Roda o Léxico obtendo os tokens ou o erro léxico
const resultadoLexico = analisarLexico('entrada.txt');

if (!resultadoLexico.sucesso) {
    console.log("❌ FALHA NA COMPILAÇÃO (Fase Léxica):");
    console.log(resultadoLexico.erro);
} else {
    // 2. Passa a lista de tokens direto para o Sintático na memória
    const resultadoSintatico = analisarSintatico(resultadoLexico.tokens);
    
    if (resultadoSintatico.status === "SUCESSO") {
        console.log("✅ SUCESSO:");
        console.log(resultadoSintatico.mensagem);
    } else {
        console.log("❌ FALHA NA COMPILAÇÃO (Fase Sintática):");
        console.log(resultadoSintatico);
    }
}