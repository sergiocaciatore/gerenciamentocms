export interface LpuStandardItem {
    id: string;
    description: string;
    unit?: string;
    isGroup?: boolean; // Main Title (e.g. 1)
    isSubGroup?: boolean; // Subtitle (e.g. 1.1)
}

export const LPU_STANDARD_ITEMS: LpuStandardItem[] = [
    // 1 MOBILIZAÇÃO E SERVIÇOS PRELIMINARES
    { id: "1", description: "MOBILIZAÇÃO E SERVIÇOS PRELIMINARES", isGroup: true },

    // 1.1 Documentação
    { id: "1.1", description: "Documentação", isSubGroup: true },
    { id: "1.1.2", description: "Elaborar documentação de \"as built\" seguindo o padrão dos projetos executivos emitidos. (Todas as disciplinas)", unit: "m²" },
    { id: "1.1.3", description: "Seguro de Obra;", unit: "m²" },
    { id: "1.1.4", description: "DATA BOOK, documentação da obra inclusive manual do proprietário, as built, notas fiscais, garantias e manuais técnicos.", unit: "vb" },
    { id: "1.1.5", description: "Documentação de obra (ASO/ PCMAT/ PPRA /PCMSO / APR / Etc..);", unit: "vb" },
    { id: "1.1.6", description: "Fornecimento de ART de execução da obra com comprovante de pagamento junto ao CREA.", unit: "und" },

    // 1.2 Mobilização
    { id: "1.2", description: "Mobilização", isSubGroup: true },
    { id: "1.2.1", description: "Região Norte- Mobilização de pessoal, equipamentos e materiais de obra (incluso administração, epi´s, alimentação, transportes, ferramentas, equipamentos, andaimes).", unit: "und" },
    { id: "1.2.2", description: "Região Nordeste - Mobilização de pessoal, equipamentos e materiais de obra (incluso administração, epi´s, alimentação, transportes, ferramentas, equipamentos, andaimes).", unit: "und" },
    { id: "1.2.3", description: "Região Centro Oeste - Mobilização de pessoal, equipamentos e materiais de obra (incluso administração, epi´s, alimentação, transportes, ferramentas, equipamentos, andaimes).", unit: "und" },
    { id: "1.2.4", description: "Região Sudeste - Mobilização de pessoal, equipamentos e materiais de obra (incluso administração, epi´s, alimentação, transportes, ferramentas, equipamentos, andaimes).", unit: "und" },
    { id: "1.2.5", description: "Região Sul - Mobilização de pessoal, equipamentos e materiais de obra (incluso administração, epi´s, alimentação, transportes, ferramentas, equipamentos, andaimes).", unit: "und" },

    // 1.3 Equipe técnica de obra
    { id: "1.3", description: "Equipe técnica de obra", isSubGroup: true },
    { id: "1.3.1", description: "Técnico de segurança;", unit: "mês" },
    { id: "1.3.2", description: "Mestre de obras;", unit: "mês" },
    { id: "1.3.3", description: "Encarregado;", unit: "mês" },
    { id: "1.3.4", description: "Almoxarife;", unit: "mês" },
    { id: "1.3.5", description: "Engenheiro / Arquiteto residente - Full time.", unit: "mês" },

    // 1.4 Canteiro e equipamentos
    { id: "1.4", description: "Canteiro e equipamentos", isSubGroup: true },
    { id: "1.4.1", description: "Tapume para isolamento da obra;", unit: "m²" },
    { id: "1.4.2", description: "Tela fachadeira para proteção de obra;", unit: "m²" },
    { id: "1.4.3", description: "Containers: Tipo escritório;", unit: "mês" },
    { id: "1.4.4", description: "Containers: Tipo sanitário;", unit: "mês" },
    { id: "1.4.5", description: "Banheiro químico;", unit: "mês" },
    { id: "1.4.6", description: "Andaime fachadeiro;", unit: "m²" },
    { id: "1.4.7", description: "Plataforma articulada telescópica - até 12 m;", unit: "dia" },
    { id: "1.4.8", description: "Plataforma Tesoura - até 8 m.", unit: "dia" }
];
