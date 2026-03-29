# Makefile - Analisador Léxico

all: run

run:
	@echo "Executando o Analisador Léxico..."
	@node lexico.js

clean:
	@rm -f saida.txt lexico
	@echo "Limpeza concluída."