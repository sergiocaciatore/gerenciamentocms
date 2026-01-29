
export default function PrivacyPolicy() {
    return (
        <div className="min-h-screen bg-gray-50 p-8 font-sans text-gray-800">
            <div className="max-w-4xl mx-auto bg-white p-10 rounded-2xl shadow-sm">
                <h1 className="text-3xl font-bold mb-2">Política de Privacidade</h1>
                <p className="mb-8 text-sm text-gray-500">
                    O aplicativo <strong>Gerenciamento CMS</strong> compromete-se com a proteção e transparência no tratamento dos seus dados. Esta política detalha como coletamos, usamos e protegemos suas informações de acordo com a Política de Dados do Usuário dos Serviços de API do Google.
                </p>

                <div className="space-y-8">
                    {/* 1. Data Accessed */}
                    <section>
                        <h2 className="text-xl font-bold bg-blue-50 text-blue-800 px-4 py-2 rounded-lg mb-4 border-l-4 border-blue-600">
                            1. Dados Acessados (Data Accessed)
                        </h2>
                        <p className="mb-3">
                            Nosso aplicativo solicita acesso limitado e específico à sua conta Google. Acessamos apenas os seguintes tipos de dados:
                        </p>
                        <ul className="list-disc pl-6 space-y-2 text-gray-700">
                            <li>
                                <strong>Informações Básicas do Perfil (Profile & Email):</strong> Acessamos seu endereço de e-mail, nome e imagem do perfil para autenticar sua identidade e personalizar sua experiência no aplicativo.
                            </li>
                            <li>
                                <strong>Google Drive (Read-only Metadata):</strong> Solicitamos o escopo <code>https://www.googleapis.com/auth/drive.readonly</code> estritamente para verificar se você possui acesso a pastas compartilhadas corporativas específicas.
                                <br />
                                <span className="text-sm italic text-gray-500">Nota: Não lemos o conteúdo dos seus arquivos pessoais, nem baixamos ou modificamos seus documentos. Apenas verificamos metadados de permissão para controle de acesso (login gate).</span>
                            </li>
                        </ul>
                    </section>

                    {/* 2. Data Usage */}
                    <section>
                        <h2 className="text-xl font-bold bg-blue-50 text-blue-800 px-4 py-2 rounded-lg mb-4 border-l-4 border-blue-600">
                            2. Uso dos Dados (Data Usage)
                        </h2>
                        <p className="mb-3">
                            Utilizamos os dados coletados exclusivamente para o funcionamento técnico e de segurança do aplicativo:
                        </p>
                        <ul className="list-disc pl-6 space-y-2 text-gray-700">
                            <li>
                                <strong>Autenticação:</strong> Seu e-mail e perfil são usados para criar e manter sua sessão de usuário segura (via Firebase Authentication).
                            </li>
                            <li>
                                <strong>Controle de Acesso:</strong> A consulta ao Google Drive é usada unicamente para validar se seu usuário tem permissão para acessar o dashboard do sistema (autorização baseada em grupo/pasta).
                            </li>
                        </ul>
                        <p className="mt-3 font-semibold text-gray-900">
                            O Gerenciamento CMS não utiliza seus dados do Google para fins de publicidade, marketing, ou treinamento de modelos de IA.
                        </p>
                    </section>

                    {/* 3. Data Sharing */}
                    <section>
                        <h2 className="text-xl font-bold bg-blue-50 text-blue-800 px-4 py-2 rounded-lg mb-4 border-l-4 border-blue-600">
                            3. Compartilhamento de Dados (Data Sharing)
                        </h2>
                        <p className="mb-3">
                            <strong>Não compartilhamos seus dados pessoais ou arquivos do Google Drive com terceiros</strong>, nem vendemos suas informações.
                        </p>
                        <p className="mb-2">
                            A única transferência de dados ocorre com nossos provedores de infraestrutura segura para fins estritos de processamento:
                        </p>
                        <ul className="list-disc pl-6 space-y-2 text-gray-700">
                            <li>
                                <strong>Google Cloud / Firebase:</strong> Utilizamos estes serviços para hospedagem, autenticação e banco de dados. Eles processam os dados em nosso nome seguindo rígidos padrões de segurança.
                            </li>
                        </ul>
                    </section>

                    {/* 4. Storage & Protection */}
                    <section>
                        <h2 className="text-xl font-bold bg-blue-50 text-blue-800 px-4 py-2 rounded-lg mb-4 border-l-4 border-blue-600">
                            4. Armazenamento e Proteção (Storage & Protection)
                        </h2>
                        <p className="mb-3">
                            Adotamos práticas de segurança de padrão industrial para proteger seus dados:
                        </p>
                        <ul className="list-disc pl-6 space-y-2 text-gray-700">
                            <li>
                                <strong>Criptografia:</strong> Todos os dados transmitidos entre seu navegador e nossos servidores são criptografados usando HTTPS (TLS/SSL). Dados sensíveis em repouso são protegidos pela infraestrutura do Google Cloud.
                            </li>
                            <li>
                                <strong>Acesso Restrito:</strong> O acesso aos dados de backend é restrito a pessoal técnico autorizado e protegido por autenticação multifator.
                            </li>
                        </ul>
                    </section>

                    {/* 5. Retention & Deletion */}
                    <section>
                        <h2 className="text-xl font-bold bg-blue-50 text-blue-800 px-4 py-2 rounded-lg mb-4 border-l-4 border-blue-600">
                            5. Retenção e Exclusão (Retention & Deletion)
                        </h2>
                        <ul className="list-disc pl-6 space-y-2 text-gray-700">
                            <li>
                                <strong>Retenção:</strong> Mantemos seus dados de perfil apenas enquanto sua conta estiver ativa e for necessária para o acesso ao sistema. Tokens de acesso são temporários e expiram automaticamente.
                            </li>
                            <li>
                                <strong>Exclusão pelo Usuário:</strong> Você pode revogar o acesso do nosso aplicativo à sua conta Google a qualquer momento visitando a página de <a href="https://myaccount.google.com/permissions" target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">Permissões da Conta Google</a>.
                            </li>
                            <li>
                                <strong>Solicitação de Exclusão:</strong> Para solicitar a exclusão completa de seus dados de nossos registros, envie um e-mail para <a href="mailto:scaciatore@gmail.com" className="text-blue-600 font-bold">scaciatore@gmail.com</a>. Processaremos sua solicitação em até 30 dias.
                            </li>
                        </ul>
                    </section>
                </div>

                <div className="mt-12 pt-6 border-t border-gray-100 flex justify-between items-center bg-gray-50 p-4 rounded-xl">
                    <p className="text-sm text-gray-500">Desenvolvido por Sergio Caciatore</p>
                    <a href="/" className="px-6 py-2 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700 transition-colors shadow-sm">
                        Voltar para o Login
                    </a>
                </div>
            </div>
        </div>
    );
}
