export interface SupplierQuotePermissions {
    allow_quantity_change: boolean;
    allow_add_items: boolean;
    allow_remove_items: boolean;
    allow_lpu_edit: boolean;
}

export interface SupplierAddress {
    street: string;
    number: string;
    city: string;
    state: string;
    neighborhood: string;
}

export interface SupplierWork {
    id: string;
    regional: string;
    go_live_date: string;
    address: SupplierAddress;
}

export interface SupplierLPUData {
    id: string;
    work_id: string;
    limit_date: string;
    status?: 'draft' | 'waiting' | 'submitted';
    quote_token?: string;
    quote_permissions?: SupplierQuotePermissions;
    prices?: Record<string, number>;
    quantities?: Record<string, number>;
    selected_items?: string[];
    work?: SupplierWork;
}

export interface SupplierLPUProps {
    initialLpu: SupplierLPUData;
    token: string;
    cnpj: string;
}
