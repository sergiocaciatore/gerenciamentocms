import { useState } from "react";
import { MagnifyingGlassIcon, TrashIcon, CheckIcon } from "@heroicons/react/24/outline";
import { collection, getDocs, deleteDoc, doc, updateDoc, setDoc } from "firebase/firestore";
import { db } from "../../../firebase";
import ConfirmationModal from "../../../components/ConfirmationModal";
import { useEffect } from "react";
import { generateSequentialId } from "../../../utils/generateId";

interface Address {
  cep: string;
  rua: string;
  numero: string;
  complemento: string;
  cidade: string;
  estado: string;
}

const initialAddress: Address = {
  cep: "",
  rua: "",
  numero: "",
  complemento: "",
  cidade: "",
  estado: "",
};

export default function ProjectForm() {
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    id: "",
    cnpj: "",
    razaoSocial: "",
    companyAddress: { ...initialAddress },
    projectAddress: { ...initialAddress },
    projectType: "",
    observations: "",
    totalArea: "",
    areaToConstruct: "",
    builtArea: "",
  });

  const [modal, setModal] = useState({
    isOpen: false,
    title: "",
    message: "",
    type: "info" as "success" | "danger" | "warning" | "info",
    onConfirm: () => {},
    singleButton: false,
  });

  const projectTypes = [
    "Moving",
    "Expansão",
    "BTS",
    "Reforma",
    "Ampliação de área",
    "Projeto",
    "Licenças",
  ];


  const [searchTerm, setSearchTerm] = useState("");
  const [showSuggestions, setShowSuggestions] = useState(false);

  interface Project {
    id?: string;
    cnpj: string;
    razaoSocial: string;
    companyAddress: Address;
    projectAddress: Address;
    projectType: string;
    totalArea: string;
    areaToConstruct: string;
    builtArea: string;
    observations: string;
  }

  const [projects, setProjects] = useState<Project[]>([]);

  useEffect(() => {
    const fetchProjects = async () => {
      try {
        const querySnapshot = await getDocs(collection(db, "AMZ_Projects"));
        const projectsList = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Project));
        setProjects(projectsList);
      } catch (error) {
        console.error("Erro ao buscar obras:", error);
      }
    };

    fetchProjects();
  }, []);

  const filteredProjects = projects.filter(
    (project) =>
      project.razaoSocial.toLowerCase().includes(searchTerm.toLowerCase()) ||
      project.cnpj.includes(searchTerm)
  );

  const selectProject = (project: Project) => {
    setFormData({
      ...project,
      id: project.id || "",
    });
    setSearchTerm(project.razaoSocial);
    setShowSuggestions(false);
  };

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchTerm(e.target.value);
    setShowSuggestions(true);
  };

  // ... existing formatCNPJ and formatCEP ...

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

  const handleInputChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>,
    section: "root" | "companyAddress" | "projectAddress" = "root"
  ) => {
    const { name } = e.target;
    let { value } = e.target;

    // Apply masks
    if (name === "cnpj") {
      value = formatCNPJ(value);
    } else if (name === "cep") {
      value = formatCEP(value);
    }

    if (section === "root") {
      setFormData((prev) => ({ ...prev, [name]: value }));
    } else {
      setFormData((prev) => ({
        ...prev,
        [section]: { ...prev[section], [name]: value },
      }));
    }
  };

  const clearForm = () => {
    setFormData({
      id: "",
      cnpj: "",
      razaoSocial: "",
      companyAddress: { ...initialAddress },
      projectAddress: { ...initialAddress },
      projectType: "",
      observations: "",
      totalArea: "",
      areaToConstruct: "",
      builtArea: "",
    });
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
          companyAddress: {
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

  const fetchCEP = async (type: "companyAddress" | "projectAddress") => {
    const cep = formData[type].cep.replace(/\D/g, "");
    if (cep.length !== 8) return;

    setLoading(true);
    try {
      const response = await fetch(`https://brasilapi.com.br/api/cep/v1/${cep}`);
      const data = await response.json();
      if (!data.errors) {
        setFormData((prev) => ({
          ...prev,
          [type]: {
            ...prev[type],
            rua: data.street,
            cidade: data.city,
            estado: data.state,
          },
        }));
      }
    } catch (error) {
      console.error("Erro ao buscar CEP:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    // Basic validation
    if (!formData.razaoSocial) {
      showModal("Campo Obrigatório", "Por favor, preencha a Razão Social da empresa.", "warning", undefined, true);
      return;
    }
    
    showModal(
        "Confirmar Cadastro",
        `Deseja ${formData.id ? 'atualizar' : 'cadastrar'} a obra "${formData.razaoSocial}"?`,
        "info",
        async () => {
            setLoading(true);
            try {
                if (formData.id) {
                    // Update existing
                    const { id, ...dataToSave } = formData;
                    await updateDoc(doc(db, "AMZ_Projects", id), dataToSave);
                    
                    setProjects(prev => prev.map(p => p.id === id ? formData as Project : p));
                    showModal("Sucesso", "Obra atualizada com sucesso!", "success", () => clearForm(), true);
                } else {
                    // Create new
                    const { id, ...dataToSave } = formData; // Exclude empty ID
                    void id; // Silence unused variable lint
                    
                    const newId = await generateSequentialId("AMZ-OBRA");
                    await setDoc(doc(db, "AMZ_Projects", newId), dataToSave);
                    
                    const newProject = { ...formData, id: newId } as Project;
                    setProjects((prev) => [...prev, newProject]);
                    showModal("Sucesso", "Obra cadastrada com sucesso!", "success", () => clearForm(), true);
                }
            } catch (error) {
                console.error("Erro ao salvar obra:", error);
                showModal("Erro", "Erro ao salvar obra. Tente novamente.", "danger", undefined, true);
            } finally {
                setLoading(false);
            }
        }
    );
  };

  const handleDelete = () => {
      if (!formData.id) return;

      showModal(
          "Excluir Obra",
          `Tem certeza que deseja excluir a obra "${formData.razaoSocial}"? Esta ação não pode ser desfeita.`,
          "danger",
          async () => {
              setLoading(true);
              try {
                  await deleteDoc(doc(db, "AMZ_Projects", formData.id));
                  setProjects(prev => prev.filter(p => p.id !== formData.id));
                  showModal("Excluído", "Obra excluída com sucesso.", "success", () => clearForm(), true);
              } catch (error) {
                  console.error("Erro ao excluir obra:", error);
                  showModal("Erro", "Erro ao excluir obra. Tente novamente.", "danger", undefined, true);
              } finally {
                  setLoading(false);
              }
          }
      );
  };


  const renderAddressFields = (
    title: string,
    section: "companyAddress" | "projectAddress",
    readOnly: boolean = false
  ) => (
    <div className="space-y-4">
      <h3 className="text-lg font-semibold text-gray-800 border-b pb-2">{title}</h3>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        {/* CEP */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">CEP</label>
          <div className="relative">
            <input
              type="text"
              name="cep"
              value={formData[section].cep}
              onChange={(e) => handleInputChange(e, section)}
              onBlur={() => fetchCEP(section)}
              placeholder="00000-000"
              maxLength={9}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all"
            />
            <div className="absolute right-3 top-2.5 text-gray-400">
              <MagnifyingGlassIcon className="w-5 h-5" />
            </div>
          </div>
        </div>

        {/* Endereço (Rua) */}
        <div className="md:col-span-2">
          <label className="block text-sm font-medium text-gray-700 mb-1">Endereço (Rua)</label>
          <input
            type="text"
            name="rua"
            value={formData[section].rua}
            onChange={(e) => handleInputChange(e, section)}
             readOnly={readOnly}
            className={`w-full px-4 py-2 border border-gray-300 rounded-lg outline-none transition-all ${readOnly ? 'bg-gray-100' : 'bg-gray-50 focus:ring-2 focus:ring-blue-500 focus:border-blue-500'}`}
          />
        </div>

        {/* Número */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Número</label>
          <input
            type="text"
            name="numero"
            value={formData[section].numero}
            onChange={(e) => handleInputChange(e, section)}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all"
          />
        </div>

        {/* Complemento */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Complemento</label>
          <input
            type="text"
            name="complemento"
            value={formData[section].complemento}
            onChange={(e) => handleInputChange(e, section)}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all"
          />
        </div>

        {/* Cidade */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Cidade</label>
          <input
            type="text"
            name="cidade"
            value={formData[section].cidade}
            onChange={(e) => handleInputChange(e, section)}
             readOnly={readOnly}
             className={`w-full px-4 py-2 border border-gray-300 rounded-lg outline-none transition-all ${readOnly ? 'bg-gray-100' : 'bg-gray-50 focus:ring-2 focus:ring-blue-500 focus:border-blue-500'}`}
          />
        </div>

        {/* Estado */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Estado</label>
          <input
            type="text"
            name="estado"
            value={formData[section].estado}
            onChange={(e) => handleInputChange(e, section)}
             readOnly={readOnly}
             className={`w-full px-4 py-2 border border-gray-300 rounded-lg outline-none transition-all ${readOnly ? 'bg-gray-100' : 'bg-gray-50 focus:ring-2 focus:ring-blue-500 focus:border-blue-500'}`}
          />
        </div>
      </div>
    </div>
  );

  return (
    <div className="flex flex-col h-full relative">
      <div className="p-4 md:p-8 space-y-8">
        {/* Barra de Busca de Obras */}
        <div className="relative z-10">
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Buscar Obra (Editar Existente)
          </label>
          <div className="relative">
            <input
              type="text"
              value={searchTerm}
              onChange={handleSearchChange}
              onFocus={() => setShowSuggestions(true)}
              placeholder="Digite o nome da empresa ou CNPJ para buscar..."
              className="w-full px-4 py-3 pl-10 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all shadow-sm"
            />
            <div className="absolute left-3 top-3.5 text-gray-400">
              <MagnifyingGlassIcon className="w-5 h-5" />
            </div>
            
            {/* Sugestões */}
            {showSuggestions && searchTerm.length > 0 && (
              <div className="absolute w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-xl max-h-60 overflow-y-auto">
                {filteredProjects.length > 0 ? (
                  filteredProjects.map((project, index) => (
                    <div
                      key={index}
                      onClick={() => selectProject(project)}
                      className="px-4 py-3 hover:bg-gray-50 cursor-pointer border-b last:border-b-0 transition-colors"
                    >
                      <div className="font-medium text-gray-800">{project.razaoSocial}</div>
                      <div className="text-sm text-gray-500">
                        CNPJ: {formatCNPJ(project.cnpj)} - {project.projectType}
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="px-4 py-3 text-gray-500 text-sm">
                    Nenhuma obra encontrada.
                  </div>
                )}
              </div>
            )}
            
            {/* Backdrop transparente para fechar sugestões ao clicar fora */}
            {showSuggestions && (
              <div 
                className="fixed inset-0 z-[-1]" 
                onClick={() => setShowSuggestions(false)}
              ></div>
            )}
          </div>
        </div>

        {/* Dados da Empresa */}
        <div className="space-y-4">
          <h3 className="text-lg font-semibold text-gray-800 border-b pb-2">Dados da Empresa</h3>
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
              <p className="text-xs text-gray-500 mt-1">Busca automática de dados e endereço da empresa.</p>
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

        {/* Endereço da Empresa (Preenchido pelo CNPJ) */}
        {renderAddressFields("Endereço da Empresa (Sede)", "companyAddress")}

        {/* Endereço da Obra (Separado) */}
        {renderAddressFields("Endereço da Obra", "projectAddress")}

        {/* Detalhes da Obra */}
        <div className="space-y-4">
          <h3 className="text-lg font-semibold text-gray-800 border-b pb-2">Detalhes da Obra</h3>
          <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
            {/* Tipo */}
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">Tipo</label>
              <select
                name="projectType"
                value={formData.projectType}
                onChange={(e) => handleInputChange(e, "root")}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg bg-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all"
              >
                <option value="">Selecione o tipo da obra</option>
                {projectTypes.map((type) => (
                  <option key={type} value={type}>
                    {type}
                  </option>
                ))}
              </select>
            </div>

            {/* Áreas */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Área Total (m²)</label>
              <input
                type="number"
                name="totalArea"
                value={formData.totalArea}
                onChange={(e) => handleInputChange(e, "root")}
                placeholder="0.00"
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Área a Construir (m²)</label>
              <input
                type="number"
                name="areaToConstruct"
                value={formData.areaToConstruct}
                onChange={(e) => handleInputChange(e, "root")}
                placeholder="0.00"
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Área Construída (m²)</label>
              <input
                type="number"
                name="builtArea"
                value={formData.builtArea}
                onChange={(e) => handleInputChange(e, "root")}
                placeholder="0.00"
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all"
              />
            </div>

            {/* Observações */}
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">Observações</label>
              <textarea
                name="observations"
                value={formData.observations}
                onChange={(e) => handleInputChange(e, "root")}
                rows={4}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all resize-none"
                placeholder="Informações adicionais sobre o projeto..."
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
          {loading ? 'Salvando...' : (formData.id ? 'Atualizar Obra' : 'Cadastrar Obra')}
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
