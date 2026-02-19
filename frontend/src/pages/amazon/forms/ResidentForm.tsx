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

interface Resident {
  id?: string;
  name: string;
  phone: string;
  email: string;
  creaCau: string;
  rg: string;
  cpf: string;
  address: Address;
  cnpj: string;
}

const initialAddress: Address = {
  cep: "",
  rua: "",
  numero: "",
  complemento: "",
  cidade: "",
  estado: "",
};

const initialResident: Resident = {
  name: "",
  phone: "",
  email: "",
  creaCau: "",
  rg: "",
  cpf: "",
  address: { ...initialAddress },
  cnpj: "",
};

export default function ResidentForm() {
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState<Resident>(initialResident);
  
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
  const [residents, setResidents] = useState<Resident[]>([]);

  useEffect(() => {
    const fetchResidents = async () => {
      try {
        const querySnapshot = await getDocs(collection(db, "AMZ_Residents"));
        const residentsList = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Resident));
        setResidents(residentsList);
      } catch (error) {
        console.error("Erro ao buscar residentes:", error);
      }
    };

    fetchResidents();
  }, []);

  const filteredResidents = residents.filter(
    (resident) =>
      resident.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      resident.cpf.includes(searchTerm)
  );

  const selectResident = (resident: Resident) => {
    setFormData({
      ...resident,
      id: resident.id || "",
    });
    setSearchTerm(resident.name);
    setShowSuggestions(false);
  };

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchTerm(e.target.value);
    setShowSuggestions(true);
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

  const formatCPF = (value: string) => {
    return value
      .replace(/\D/g, "")
      .replace(/(\d{3})(\d)/, "$1.$2")
      .replace(/(\d{3})(\d)/, "$1.$2")
      .replace(/(\d{3})(\d{1,2})/, "$1-$2")
      .replace(/(-\d{2})\d+?$/, "$1"); // Limited to 11 digits format
  };

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
    section: "root" | "address" = "root"
  ) => {
    const { name } = e.target;
    let { value } = e.target;

    // Apply masks
    if (name === "cpf") {
        value = formatCPF(value);
    } else if (name === "cnpj") {
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
    }
  };

  const clearForm = () => {
    setFormData(initialResident);
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

  const handleSave = async () => {
    // Basic validation
    if (!formData.name) {
      showModal("Campo Obrigatório", "Por favor, preencha o Nome Completo do residente.", "warning", undefined, true);
      return;
    }
    
    showModal(
        "Confirmar Cadastro",
        `Deseja ${formData.id ? 'atualizar' : 'cadastrar'} o residente "${formData.name}"?`,
        "info",
        async () => {
            setLoading(true);
            try {
                if (formData.id) {
                    // Update existing
                    const { id, ...dataToSave } = formData;
                    await updateDoc(doc(db, "AMZ_Residents", id), dataToSave);
                    
                    setResidents(prev => prev.map(p => p.id === id ? formData : p));
                    showModal("Sucesso", "Residente atualizado com sucesso!", "success", () => clearForm(), true);
                } else {
                    // Create new
                    const { id, ...dataToSave } = formData;
                    void id; // Silence unused variable lint
                    
                    const newId = await generateSequentialId("AMZ-RES");
                    await setDoc(doc(db, "AMZ_Residents", newId), dataToSave);
                    
                    const newResident = { ...formData, id: newId };
                    setResidents((prev) => [...prev, newResident]);
                    showModal("Sucesso", "Residente cadastrado com sucesso!", "success", () => clearForm(), true);
                }
            } catch (error) {
                console.error("Erro ao salvar residente:", error);
                showModal("Erro", "Erro ao salvar residente. Tente novamente.", "danger", undefined, true);
            } finally {
                setLoading(false);
            }
        }
    );
  };

  const handleDelete = () => {
      if (!formData.id) return;

      showModal(
          "Excluir Residente",
          `Tem certeza que deseja excluir o residente "${formData.name}"? Esta ação não pode ser desfeita.`,
          "danger",
          async () => {
              setLoading(true);
              try {
                  await deleteDoc(doc(db, "AMZ_Residents", formData.id as string));
                  setResidents(prev => prev.filter(p => p.id !== formData.id));
                  showModal("Excluído", "Residente excluído com sucesso.", "success", () => clearForm(), true);
              } catch (error) {
                  console.error("Erro ao excluir residente:", error);
                  showModal("Erro", "Erro ao excluir residente. Tente novamente.", "danger", undefined, true);
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
            Buscar Residente (Editar Existente)
          </label>
          <div className="relative">
            <input
              type="text"
              value={searchTerm}
              onChange={handleSearchChange}
              onFocus={() => setShowSuggestions(true)}
              placeholder="Digite o nome ou CPF para buscar..."
              className="w-full px-4 py-3 pl-10 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all shadow-sm"
            />
            <div className="absolute left-3 top-3.5 text-gray-400">
              <MagnifyingGlassIcon className="w-5 h-5" />
            </div>

            {/* Sugestões */}
            {showSuggestions && searchTerm.length > 0 && (
              <div className="absolute w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-xl max-h-60 overflow-y-auto">
                {filteredResidents.length > 0 ? (
                  filteredResidents.map((resident, index) => (
                    <div
                      key={index}
                      onClick={() => selectResident(resident)}
                      className="px-4 py-3 hover:bg-gray-50 cursor-pointer border-b last:border-b-0 transition-colors"
                    >
                      <div className="font-medium text-gray-800">{resident.name}</div>
                      <div className="text-sm text-gray-500">
                        CPF: {resident.cpf}
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="px-4 py-3 text-gray-500 text-sm">
                    Nenhum residente encontrado.
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

        {/* Dados Pessoais */}
        <div className="space-y-4">
          <h3 className="text-lg font-semibold text-gray-800 border-b pb-2">Dados Pessoais</h3>
          <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Nome Completo</label>
              <input
                type="text"
                name="name"
                value={formData.name}
                onChange={(e) => handleInputChange(e, "root")}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all"
              />
            </div>
             <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Telefone</label>
              <input
                type="text"
                name="phone"
                value={formData.phone}
                onChange={(e) => handleInputChange(e, "root")}
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
                value={formData.email}
                onChange={(e) => handleInputChange(e, "root")}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all"
              />
            </div>
          </div>
        </div>

        {/* Documentos */}
        <div className="space-y-4">
          <h3 className="text-lg font-semibold text-gray-800 border-b pb-2">Documentos</h3>
          <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
             <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">CREA/CAU</label>
              <input
                type="text"
                name="creaCau"
                value={formData.creaCau}
                onChange={(e) => handleInputChange(e, "root")}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">RG</label>
              <input
                type="text"
                name="rg"
                value={formData.rg}
                onChange={(e) => handleInputChange(e, "root")}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">CPF</label>
              <input
                type="text"
                name="cpf"
                value={formData.cpf}
                onChange={(e) => handleInputChange(e, "root")}
                placeholder="000.000.000-00"
                maxLength={14}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all"
              />
            </div>
          </div>
        </div>

        {/* Pessoa Jurídica */}
         <div className="space-y-4">
          <h3 className="text-lg font-semibold text-gray-800 border-b pb-2">Pessoa Jurídica</h3>
          <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">CNPJ</label>
              <input
                type="text"
                name="cnpj"
                value={formData.cnpj}
                onChange={(e) => handleInputChange(e, "root")}
                placeholder="00.000.000/0000-00"
                maxLength={18}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all"
              />
            </div>
          </div>
        </div>

        {/* Endereço */}
        <div className="space-y-4">
          <h3 className="text-lg font-semibold text-gray-800 border-b pb-2">Endereço</h3>
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
                 {loading && (
                  <div className="absolute right-10 top-2.5">
                    <div className="animate-spin h-5 w-5 border-2 border-blue-500 rounded-full border-t-transparent"></div>
                  </div>
                )}
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

      </div>

      {/* Actions */}
      <div className="mt-8 flex justify-end gap-3 p-4 md:p-8 pt-0">
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
          {loading ? 'Salvando...' : (formData.id ? 'Atualizar Residente' : 'Cadastrar Residente')}
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
