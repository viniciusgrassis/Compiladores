#include <stdio.h>
#include <stdlib.h>
#include <string.h>

int main(){

    FILE *arq;
    FILE *arq2;

    char leitor;

    int linha = 0;
    int coluna = 0;
    int contador = 0;
    int iniCol = 0;

    char token[2000];

    arq = fopen("entrada.txt", "r");
    arq2 = fopen("saida.txt", "w");

    if(!arq || !arq2){
        fprintf(stderr, "Erro!\n");
        return -1;
    }


    fprintf(arq2, "token linha coluna\n");
    fputs("\n", arq2);


    
    while((leitor = fgetc(arq)) != EOF){
        if(leitor == ' ' || leitor == '\n'){
        // 1. Se tem palavra (contador > 0), imprime e reseta contador
            if(contador > 0){
            token[contador] = '\0';
            fprintf(arq2, "%s %d %d\n", token, linha, iniCol);
            contador = 0;
            }
        
        // 2. Independente de ter palavra, se for enter, pula a linha
            if(leitor == '\n'){
            linha++;
            coluna = 0;
            }else{
                coluna++; // O espaço também conta como uma coluna percorrida
            }
        }else{ // É uma letra!
        // 1. Se é o começo da palavra, salva a coluna
            if(contador == 0){
                iniCol = coluna + 1;
        }
        // 2. Guarda a letra e aumenta contadores
                token[contador] = leitor;
                contador++;
                coluna++;
        }
    }

    if(contador != 0){
        token[contador] = '\0';
        fprintf(arq2, "%s %d %d\n", token, linha, iniCol);
        contador = 0;

    }


    printf("Sucesso FM!\n");

    fclose(arq);
    fclose(arq2);

    return 0;


}