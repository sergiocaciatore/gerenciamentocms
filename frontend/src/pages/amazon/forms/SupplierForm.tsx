import { useState } from "react";
import { MagnifyingGlassIcon, TrashIcon, CheckIcon } from "@heroicons/react/24/outline";
import { collection, getDocs, deleteDoc, doc, updateDoc, setDoc } from "firebase/firestore";
import { db } from "../../../firebase";
import { useEffect } from "react";
import { generateSequentialId } from "../../../utils/generateId";
import ConfirmationModal from "../../../components/ConfirmationModal";

interface Address {
  cep: string;
  rua: string;
  numero: string;
  complemento: string;
  cidade: string;
  estado: string;
}

interface Contact {
  name: string;
  phone: string;
  email: string;
}

interface BillingData {
  contact: Contact;
  cnpj: string;
  address: Address;
}

interface Supplier {
  id?: string;
  cnpj: string;
  razaoSocial: string;
  address: Address;
  additionalContacts: [Contact, Contact];
  billing: BillingData;
}

const initialAddress: Address = {
  cep: "",
  rua: "",
  numero: "",
  complemento: "",
  cidade: "",
  estado: "",
};

const initialContact: Contact = {
  name: "",
  phone: "",
  email: "",
};

const initialSupplier: Supplier = {
  cnpj: "",
  razaoSocial: "",
  address: { ...initialAddress },
  additionalContacts: [{ ...initialContact }, { ...initialContact }],
  billing: {
    contact: { ...initialContact },
    cnpj: "",
    address: { ...initialAddress },
  },
};

export default function SupplierForm() {
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState<Supplier>(initialSupplier);

  const [modal, setModal] = useState({
    isOpen: false,
    title: "",
    message: "",
    type: "info" as "success" | "danger" | "warning" | "info",
    onConfirm: () => {},
    singleButton: false,
  });

  const [searchTerm, setSearchTerm] = useState("");
  const [showSuggestions, setShowSuggestions] = useState(false);

  const [suppliers, setSuppliers] = useState<Supplier[]>([]);

  useEffect(() => {
    const fetchSuppliers = async () => {
      try {
        const querySnapshot = await getDocs(collection(db, "AMZ_Suppliers"));
        const suppliersList = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Supplier));
        setSuppliers(suppliersList);
      } catch (error) {
        console.error("Erro ao buscar fornecedores:", error);
      }
    };

    fetchSuppliers();
  }, []);

  const filteredSuppliers = suppliers.filter(
    (supplier) =>
      supplier.razaoSocial.toLowerCase().includes(searchTerm.toLowerCase()) ||
      supplier.cnpj.includes(searchTerm)
  );

  const formatCNPJ = (value: string) => {
    return value
      .replace(/\D/g, "")
      .replace(/^(\d{2})(\d)/, "$1.$2")
      .replace(/^(\d{2})\.(\d{3})(\d)/, "$1.$2.$3")
      .replace(/\.(\d{3})(\d)/, ".$1/$2")
      .replace(/(\d{4})(\d)/, "$1-$2")
      .substring(0, 18);
  };

  const formatCEP = (value: string) => {
    return value
      .replace(/\D/g, "")
      .replace(/^(\d{5})(\d)/, "$1-$2")
      .substring(0, 9);
  };

  const formatPhone = (value: string) => {
    return value
      .replace(/\D/g, "")
      .replace(/^(\d{2})(\d)/, "($1) $2")
      .replace(/(\d{5})(\d)/, "$1-$2")
      .substring(0, 15);
  };

  const handleInputChange = (
    e: React.ChangeEvent<HTMLInputElement>,
    section: "root" | "address" | "contact1" | "contact2" | "billingContact" | "billingAddress" | "billingCNPJ" = "root"
  ) => {
    const { name } = e.target;
    let { value } = e.target;

    // Apply masks
    if (name === "cnpj" || name === "billingCNPJ") {
      value = formatCNPJ(value);
    } else if (name === "cep") {
      value = formatCEP(value);
    } else if (name === "phone") {
      value = formatPhone(value);
    }

    if (section === "root") {
      setFormData((prev) => ({ ...prev, [name]: value }));
    } else if (section === "address") {
      setFormData((prev) => ({
        ...prev,
        address: { ...prev.address, [name]: value },
      }));
    } else if (section === "contact1") {
      const newContacts = [...formData.additionalContacts] as [Contact, Contact];
      newContacts[0] = { ...newContacts[0], [name]: value };
      setFormData((prev) => ({ ...prev, additionalContacts: newContacts }));
    } else if (section === "contact2") {
      const newContacts = [...formData.additionalContacts] as [Contact, Contact];
      newContacts[1] = { ...newContacts[1], [name]: value };
      setFormData((prev) => ({ ...prev, additionalContacts: newContacts }));
    } else if (section === "billingContact") {
      setFormData((prev) => ({
        ...prev,
        billing: { ...prev.billing, contact: { ...prev.billing.contact, [name]: value } },
      }));
    } else if (section === "billingAddress") {
      setFormData((prev) => ({
        ...prev,
        billing: { ...prev.billing, address: { ...prev.billing.address, [name]: value } },
      }));
    } else if (section === "billingCNPJ") { // Special case for billing CNPJ at root of billing object
        setFormData((prev) => ({
            ...prev,
            billing: { ...prev.billing, cnpj: value },
        }));
    }
  };

  const selectSupplier = (supplier: Supplier) => {
    setFormData({ 
        ...supplier,
        id: supplier.id || "",
    });
    setSearchTerm(supplier.razaoSocial);
    setShowSuggestions(false);
  };

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchTerm(e.target.value);
    setShowSuggestions(true);
  };

  const clearForm = () => {
    setFormData(initialSupplier);
    setSearchTerm("");
  };

  const showModal = (
      title: string, 
      message: string, 
      type: "success" | "danger" | "warning" | "info", 
      onConfirm?: () => void,
      singleButton: boolean = false
  ) => {
      setModal({
          isOpen: true,
          title,
          message,
          type,
          onConfirm: onConfirm || (() => {}),
          singleButton
      });
  };

  const handleConfirmClear = () => {
      showModal(
          "Limpar Formulário",
          "Tem certeza que deseja limpar todos os campos? Os dados não salvos serão perdidos.",
          "warning",
          () => clearForm()
      );
  };
   
  interface BrasilAPIResponse {
    cep: string;
    state: string;
    city: string;
    neighborhood: string;
    street: string;
    service: string;
  }

  // Address fetcher helper
  const fetchAddressData = async (cep: string, callback: (data: BrasilAPIResponse) => void) => {
      const cleanCep = cep.replace(/\D/g, "");
      if (cleanCep.length !== 8) return;
      
      setLoading(true);
      try {
        const response = await fetch(`https://brasilapi.com.br/api/cep/v1/${cleanCep}`);
        const data = await response.json();
        if (!data.errors) {
            callback(data);
        }
      } catch (error) {
        console.error("Erro ao buscar CEP:", error);
      } finally {
        setLoading(false);
      }
  };

  const fetchCEP = () => fetchAddressData(formData.address.cep, (data) => {
      setFormData(prev => ({
          ...prev, 
          address: { ...prev.address, rua: data.street, cidade: data.city, estado: data.state }
      }));
  });

  const fetchBillingCEP = () => fetchAddressData(formData.billing.address.cep, (data) => {
      setFormData(prev => ({
          ...prev, 
          billing: { 
              ...prev.billing, 
              address: { ...prev.billing.address, rua: data.street, cidade: data.city, estado: data.state } 
          }
      }));
  });

  // Reusing fetchCNPJ for main CNPJ only (simple version for now)
  const fetchCNPJ = async () => {
    const cnpj = formData.cnpj.replace(/\D/g, "");
    if (cnpj.length !== 14) return;

    setLoading(true);
    try {
      const response = await fetch(`https://brasilapi.com.br/api/cnpj/v1/${cnpj}`);
      const data = await response.json();
      if (!data.error) {
        setFormData((prev) => ({
          ...prev,
          razaoSocial: data.razao_social,
          address: {
            cep: data.cep,
            rua: data.logradouro,
            numero: data.numero,
            complemento: data.complemento,
            cidade: data.municipio,
            estado: data.uf,
          },
        }));
      }
    } catch (error) {
      console.error("Erro ao buscar CNPJ:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    // Basic validation
    if (!formData.razaoSocial) {
      showModal("Campo Obrigatório", "Por favor, preencha a Razão Social do fornecedor.", "warning", undefined, true);
      return;
    }
    
    showModal(
        "Confirmar Cadastro",
        `Deseja ${formData.id ? 'atualizar' : 'cadastrar'} o fornecedor "${formData.razaoSocial}"?`,
        "info",
        async () => {
            setLoading(true);
            try {
                if (formData.id) {
                    // Update existing
                    const { id, ...dataToSave } = formData;
                    await updateDoc(doc(db, "AMZ_Suppliers", id), dataToSave);
                    
                    setSuppliers(prev => prev.map(s => s.id === id ? formData : s));
                    showModal("Sucesso", "Fornecedor atualizado com sucesso!", "success", () => clearForm(), true);
                } else {
                    // Create new
                    const { id, ...dataToSave } = formData;
                    void id; // Silence unused variable lint
                    
                    const newId = await generateSequentialId("AMZ-FORN");
                    await setDoc(doc(db, "AMZ_Suppliers", newId), dataToSave);
                    
                    const newSupplier = { ...formData, id: newId };
                    setSuppliers((prev) => [...prev, newSupplier]);
                    showModal("Sucesso", "Fornecedor cadastrado com sucesso!", "success", () => clearForm(), true);
                }
            } catch (error) {
                console.error("Erro ao salvar fornecedor:", error);
                showModal("Erro", "Erro ao salvar fornecedor. Tente novamente.", "danger", undefined, true);
            } finally {
                setLoading(false);
            }
        }
    );
  };

  const handleDelete = () => {
      if (!formData.id) return;

      showModal(
          "Excluir Fornecedor",
          `Tem certeza que deseja excluir o fornecedor "${formData.razaoSocial}"? Esta ação não pode ser desfeita.`,
          "danger",
          async () => {
              setLoading(true);
              try {
                  await deleteDoc(doc(db, "AMZ_Suppliers", formData.id as string));
                  setSuppliers(prev => prev.filter(s => s.id !== formData.id));
                  showModal("Excluído", "Fornecedor excluído com sucesso.", "success", () => clearForm(), true);
              } catch (error) {
                  console.error("Erro ao excluir fornecedor:", error);
                  showModal("Erro", "Erro ao excluir fornecedor. Tente novamente.", "danger", undefined, true);
              } finally {
                  setLoading(false);
              }
          }
      );
  };

  return (
    <div className="flex flex-col h-full relative">
      <div className="p-4 md:p-8 space-y-8">
        {/* Barra de Busca */}
        <div className="relative z-10">
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Buscar Fornecedor (Editar Existente)
          </label>
          <div className="relative">
            <input
              type="text"
              value={searchTerm}
              onChange={handleSearchChange}
              onFocus={() => setShowSuggestions(true)}
              placeholder="Digite o nome ou CNPJ para buscar..."
              className="w-full px-4 py-3 pl-10 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all shadow-sm"
            />
            <div className="absolute left-3 top-3.5 text-gray-400">
              <MagnifyingGlassIcon className="w-5 h-5" />
            </div>

            {/* Sugestões */}
            {showSuggestions && searchTerm.length > 0 && (
              <div className="absolute w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-xl max-h-60 overflow-y-auto">
                {filteredSuppliers.length > 0 ? (
                  filteredSuppliers.map((supplier, index) => (
                    <div
                      key={index}
                      onClick={() => selectSupplier(supplier)}
                      className="px-4 py-3 hover:bg-gray-50 cursor-pointer border-b last:border-b-0 transition-colors"
                    >
                      <div className="font-medium text-gray-800">{supplier.razaoSocial}</div>
                      <div className="text-sm text-gray-500">CNPJ: {formatCNPJ(supplier.cnpj)}</div>
                    </div>
                  ))
                ) : (
                  <div className="px-4 py-3 text-gray-500 text-sm">
                    Nenhum fornecedor encontrado.
                  </div>
                )}
              </div>
            )}
            
            {/* Backdrop */}
            {showSuggestions && (
              <div 
                className="fixed inset-0 z-[-1]" 
                onClick={() => setShowSuggestions(false)}
              ></div>
            )}
          </div>
        </div>

        {/* Dados do Fornecedor */}
        <div className="space-y-4">
          <h3 className="text-lg font-semibold text-gray-800 border-b pb-2">Dados do Fornecedor</h3>
          <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
            {/* CNPJ */}
            <div className="relative">
              <label className="block text-sm font-medium text-gray-700 mb-1">CNPJ</label>
              <div className="relative">
                <input
                  type="text"
                  name="cnpj"
                  value={formData.cnpj}
                  onChange={(e) => handleInputChange(e, "root")}
                  onBlur={fetchCNPJ}
                  placeholder="00.000.000/0000-00"
                  maxLength={18}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all"
                />
                {loading && (
                  <div className="absolute right-3 top-2.5">
                    <div className="animate-spin h-5 w-5 border-2 border-blue-500 rounded-full border-t-transparent"></div>
                  </div>
                )}
              </div>
            </div>

            {/* Razão Social */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Razão Social</label>
              <input
                type="text"
                name="razaoSocial"
                value={formData.razaoSocial}
                onChange={(e) => handleInputChange(e, "root")}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg bg-gray-50 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all"
              />
            </div>
          </div>
        </div>

        {/* Endereço */}
        <div className="space-y-4">
          <h3 className="text-lg font-semibold text-gray-800 border-b pb-2">Endereço Fornecedor</h3>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            {/* CEP */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">CEP</label>
              <div className="relative">
                <input
                  type="text"
                  name="cep"
                  value={formData.address.cep}
                  onChange={(e) => handleInputChange(e, "address")}
                  onBlur={fetchCEP}
                  placeholder="00000-000"
                  maxLength={9}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all"
                />
                <div className="absolute right-3 top-2.5 text-gray-400">
                  <MagnifyingGlassIcon className="w-5 h-5" />
                </div>
              </div>
            </div>

            {/* Rua */}
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">Endereço (Rua)</label>
              <input
                type="text"
                name="rua"
                value={formData.address.rua}
                onChange={(e) => handleInputChange(e, "address")}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all"
              />
            </div>

            {/* Número */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Número</label>
              <input
                type="text"
                name="numero"
                value={formData.address.numero}
                onChange={(e) => handleInputChange(e, "address")}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all"
              />
            </div>

            {/* Complemento */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Complemento</label>
              <input
                type="text"
                name="complemento"
                value={formData.address.complemento}
                onChange={(e) => handleInputChange(e, "address")}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all"
              />
            </div>

            {/* Cidade */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Cidade</label>
              <input
                type="text"
                name="cidade"
                value={formData.address.cidade}
                onChange={(e) => handleInputChange(e, "address")}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all"
              />
            </div>

            {/* Estado */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Estado</label>
              <input
                type="text"
                name="estado"
                value={formData.address.estado}
                onChange={(e) => handleInputChange(e, "address")}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all"
              />
            </div>
          </div>
        </div>


        {/* Dados Adicionais */}
        <div className="space-y-4">
          <h3 className="text-lg font-semibold text-gray-800 border-b pb-2">Dados Adicionais</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            {/* Contato 1 */}
            <div className="space-y-4">
              <h4 className="font-medium text-gray-700">Contato 1</h4>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Nome do Contato</label>
                <input
                  type="text"
                  name="name"
                  value={formData.additionalContacts[0].name}
                  onChange={(e) => handleInputChange(e, "contact1")}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Telefone</label>
                <input
                  type="text"
                  name="phone"
                  value={formData.additionalContacts[0].phone}
                  onChange={(e) => handleInputChange(e, "contact1")}
                  placeholder="(00) 00000-0000"
                  maxLength={15}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                <input
                  type="email"
                  name="email"
                  value={formData.additionalContacts[0].email}
                  onChange={(e) => handleInputChange(e, "contact1")}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all"
                />
              </div>
            </div>

            {/* Contato 2 */}
            <div className="space-y-4">
              <h4 className="font-medium text-gray-700">Contato 2</h4>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Nome do Contato</label>
                <input
                  type="text"
                  name="name"
                  value={formData.additionalContacts[1].name}
                  onChange={(e) => handleInputChange(e, "contact2")}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Telefone</label>
                <input
                  type="text"
                  name="phone"
                  value={formData.additionalContacts[1].phone}
                  onChange={(e) => handleInputChange(e, "contact2")}
                  placeholder="(00) 00000-0000"
                  maxLength={15}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                <input
                  type="email"
                  name="email"
                  value={formData.additionalContacts[1].email}
                  onChange={(e) => handleInputChange(e, "contact2")}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Dados para Faturamento */}
        <div className="space-y-4">
          <h3 className="text-lg font-semibold text-gray-800 border-b pb-2">Dados para Faturamento</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
             {/* Contato Financeiro */}
             <div className="space-y-4">
                <h4 className="font-medium text-gray-700">Contato Financeiro</h4>
                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Nome do Contato</label>
                    <input
                    type="text"
                    name="name"
                    value={formData.billing.contact.name}
                    onChange={(e) => handleInputChange(e, "billingContact")}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all"
                    />
                </div>
                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Telefone</label>
                    <input
                    type="text"
                    name="phone"
                    value={formData.billing.contact.phone}
                    onChange={(e) => handleInputChange(e, "billingContact")}
                    placeholder="(00) 00000-0000"
                    maxLength={15}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all"
                    />
                </div>
                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                    <input
                    type="email"
                    name="email"
                    value={formData.billing.contact.email}
                    onChange={(e) => handleInputChange(e, "billingContact")}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all"
                    />
                </div>
             </div>

             {/* CNPJ Faturamento */}
             <div className="space-y-4">
                <h4 className="font-medium text-gray-700">Dados Fiscais</h4>
                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">CNPJ para Faturamento</label>
                    <input
                        type="text"
                        name="cnpj"
                        value={formData.billing.cnpj}
                        onChange={(e) => handleInputChange(e, "billingCNPJ")}
                        placeholder="00.000.000/0000-00"
                        maxLength={18}
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all"
                    />
                </div>
             </div>
             
             {/* Endereço de Faturamento */}
             <div className="md:col-span-2 space-y-4 border-t pt-4 mt-2">
                <h4 className="font-medium text-gray-700">Endereço de Faturamento</h4>
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">CEP</label>
                        <div className="relative">
                            <input
                            type="text"
                            name="cep"
                            value={formData.billing.address.cep}
                            onChange={(e) => handleInputChange(e, "billingAddress")}
                            onBlur={fetchBillingCEP}
                            placeholder="00000-000"
                            maxLength={9}
                            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all"
                            />
                            <div className="absolute right-3 top-2.5 text-gray-400">
                                <MagnifyingGlassIcon className="w-5 h-5" />
                            </div>
                        </div>
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Endereço (Rua)</label>
                        <input
                        type="text"
                        name="rua"
                        value={formData.billing.address.rua}
                        onChange={(e) => handleInputChange(e, "billingAddress")}
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all"
                        />
                    </div>
                     <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Número</label>
                        <input
                        type="text"
                        name="numero"
                        value={formData.billing.address.numero}
                        onChange={(e) => handleInputChange(e, "billingAddress")}
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all"
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Complemento</label>
                        <input
                        type="text"
                        name="complemento"
                        value={formData.billing.address.complemento}
                        onChange={(e) => handleInputChange(e, "billingAddress")}
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all"
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Cidade</label>
                        <input
                        type="text"
                        name="cidade"
                        value={formData.billing.address.cidade}
                        onChange={(e) => handleInputChange(e, "billingAddress")}
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all"
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Estado</label>
                        <input
                        type="text"
                        name="estado"
                        value={formData.billing.address.estado}
                        onChange={(e) => handleInputChange(e, "billingAddress")}
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all"
                        />
                    </div>
                </div>
             </div>
          </div>
        </div>
      </div>

      {/* Actions */}
      <div className="mt-8 flex justify-end gap-3 p-8">
        {formData.id && (
            <button
              onClick={handleDelete}
              disabled={loading}
              className="px-6 py-2 bg-red-100 text-red-700 font-medium rounded-lg border border-red-200 hover:bg-red-200 transition-colors flex items-center gap-2 mr-auto"
            >
              <TrashIcon className="w-5 h-5" />
              Excluir
            </button>
        )}

        <button
          onClick={handleConfirmClear}
          className="px-6 py-2 bg-white text-gray-700 font-medium rounded-lg border border-gray-300 hover:bg-gray-50 transition-colors flex items-center gap-2"
        >
          <TrashIcon className="w-5 h-5" />
          Limpar
        </button>
        <button 
          onClick={handleSave}
          disabled={loading}
          className={`px-6 py-2 bg-[#FF9900] text-black font-semibold rounded-lg shadow hover:bg-[#ffad33] transition-colors flex items-center gap-2 ${loading ? 'opacity-50 cursor-not-allowed' : ''}`}
        >
          <CheckIcon className="w-5 h-5" />
          {loading ? 'Salvando...' : (formData.id ? 'Atualizar Fornecedor' : 'Cadastrar Fornecedor')}
        </button>
      </div>
      
      <ConfirmationModal
        isOpen={modal.isOpen}
        onClose={() => setModal(prev => ({ ...prev, isOpen: false }))}
        onConfirm={modal.onConfirm}
        title={modal.title}
        message={modal.message}
        type={modal.type}
        singleButton={modal.singleButton}
      />
    </div>
  );
}
