// index.js
const { analisarLexico } = require('./lexico3');
const { analisarSintatico } = require('./sintatico3');

console.log("Iniciando Compilação...\n");

const resultadoLexico = analisarLexico('entrada.txt');

if (!resultadoLexico.sucesso) {
    console.log("❌ FALHA NA COMPILAÇÃO (Fase Léxica):");
    console.log(resultadoLexico.erro);
} else {
    const resultadoSintatico = analisarSintatico(resultadoLexico.tokens);
    
    if (resultadoSintatico.status === "SUCESSO") {
        console.log("✅ SUCESSO:");
        console.log(resultadoSintatico.mensagem);
    } else {
        console.log("❌ FALHA NA COMPILAÇÃO (Fase Sintática):");
        console.log(resultadoSintatico);
    }
}