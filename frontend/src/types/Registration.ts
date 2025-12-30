export interface AddressData {
    street: string;
    neighborhood: string;
    city: string;
    state: string;
    number?: string;
    complement?: string;
}

export interface RegistrationWork {
    id: string; // Work ID is string in UI (e.g. "Obra 1")
    regional: string;
    go_live_date: string;
    cep: string;
    address: AddressData | null;
    work_type: string;
    cnpj: string;
    business_case: string;
    capex_approved: string;
    internal_order: string;
    oi: string;
    has_engineering?: boolean;
    has_control_tower?: boolean;
    has_planning?: boolean;
    has_report?: boolean;

    // UI specific
    itemType: "Obra";
    name?: string; // Sometimes work has name? or just ID.
    description?: string; // Optional
    social_reason?: string; // For compatibility in filter logic if reused
}

export interface RegistrationEvent {
    id: string; // "Work ID" it relates to
    description: string;
    type: string;
    sla: string | number;

    // UI specific
    itemType: "Evento";
    regional?: string; // For filter compatibility
    address?: AddressData; // For filter compatibility
    work_type?: string;
    social_reason?: string;
    name?: string;
}

export interface RegistrationSupplier {
    id: string; // "Work ID" it relates to
    social_reason: string;
    cnpj: string;
    contract_start: string;
    contract_end: string;
    project: string;
    hiring_type: string;
    headquarters: string;
    legal_representative: string;
    representative_email: string;
    contact: string;
    witness: string;
    witness_email: string;
    observations: string;

    // UI specific
    itemType: "Fornecedor";
    regional?: string;
    address?: AddressData;
    work_type?: string;
    name?: string;
    description?: string;
}

export interface RegistrationTeam {
    id: string; // Work ID
    name: string;
    role: string;

    // UI specific
    itemType: "Equipe";
    regional?: string; // For filter compatibility
    address?: AddressData;
    work_type?: string;
    social_reason?: string;
    description?: string;
}

export type RegistrationItem = RegistrationWork | RegistrationEvent | RegistrationSupplier | RegistrationTeam;
