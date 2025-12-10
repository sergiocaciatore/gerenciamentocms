No routes matched location "/fornecedor/login" 

precisa corrigir a rota, lembrando que o link está em local, mas quando estiver em produção o link gerado não será local host será o link, então naõ deixe absoluto

2 - Precisamos da data go live na LPU tanto sistema quanto fornecedor em dd/mm/aaaa (verificar cadastro)

3 - Após o primeiro envio da LPU o fornecedor não conseguirá mais acessar a página

4 - Se o prazo passar a data estimada como prazo o link expira

5 - Token de Acesso do Fornecedor
0CIGSSNC
Link de acesso: http://localhost:5173/fornecedor/login

teria que ser algo do tipo /fornecedor/login/0CIGSSNC
porque pode ter várias lPUs ao mesmo tempo

6 - após o fornecedor enviar a LPU o sistema conseguirá acessar o documento que ele prpeencher, mas o fornecedor não