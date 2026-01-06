
export default function PrivacyPolicy() {
    return (
        <div className="min-h-screen bg-gray-50 p-8 font-sans text-gray-800">
            <div className="max-w-3xl mx-auto bg-white p-10 rounded-2xl shadow-sm">
                <h1 className="text-3xl font-bold mb-6">Política de Privacidade</h1>
                <p className="mb-4 text-sm text-gray-500">Última atualização: {new Date().toLocaleDateString()}</p>

                <section className="mb-6">
                    <h2 className="text-xl font-semibold mb-3">1. Introdução</h2>
                    <p className="mb-2">
                        O <strong>Gerenciamento CMS</strong> respeita a sua privacidade. Esta política descreve como acessamos, usamos e protegemos suas informações quando você utiliza nosso sistema com sua conta Google.
                    </p>
                </section>

                <section className="mb-6">
                    <h2 className="text-xl font-semibold mb-3">2. Escopos e Dados do Google</h2>
                    <p className="mb-2">
                        Nosso aplicativo solicita acesso à sua conta Google para verificar permissões de acesso. Especificamente, utilizamos o escopo:
                    </p>
                    <ul className="list-disc pl-5 mb-2 mt-1 bg-gray-50 p-3 rounded-lg border border-gray-100">
                        <li>
                            <code className="text-blue-600 font-bold">drive.readonly</code>: Usado estritamente para verificar se você possui permissão de leitura em uma pasta específica do sistema. Não lemos, baixamos ou armazenamos seus arquivos pessoais.
                        </li>
                    </ul>
                    <p>
                        Armazenamos apenas seu ID de token temporariamente para manter sua sessão ativa.
                    </p>
                </section>

                <section className="mb-6">
                    <h2 className="text-xl font-semibold mb-3">3. Compartilhamento de Dados</h2>
                    <p>
                        Não compartilhamos suas informações pessoais com terceiros, exceto quando exigido por lei. Dados de uso são utilizados apenas internamente para melhoria do sistema.
                    </p>
                </section>

                <section className="mb-6">
                    <h2 className="text-xl font-semibold mb-3">4. Contato</h2>
                    <p>
                        Para dúvidas sobre esta política, entre em contato através do e-mail: scaciatore@gmail.com
                    </p>
                </section>

                <div className="mt-10 pt-6 border-t border-gray-100 text-center">
                    <a href="/" className="text-blue-600 hover:text-blue-800 font-medium">Voltar para o Login</a>
                </div>
            </div>
        </div>
    );
}
