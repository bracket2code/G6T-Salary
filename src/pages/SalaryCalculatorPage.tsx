import React, { useState, useEffect, useRef } from "react";
import {
  Calculator,
  Search,
  User,
  DollarSign,
  Clock,
  FileText,
  RefreshCw,
  ChevronDown,
  X,
  Check,
} from "lucide-react";
import { PageHeader } from "../components/layout/PageHeader";
import { Card, CardContent, CardHeader } from "../components/ui/Card";
import { Button } from "../components/ui/Button";
import { Input } from "../components/ui/Input";
import { Select } from "../components/ui/Select";
import { Worker, SalaryCalculation } from "../types/salary";
import { formatDate } from "../lib/utils";
import { useAuthStore } from "../store/authStore";

// Combined Search and Select Component
interface WorkerSearchSelectProps {
  workers: Worker[];
  selectedWorkerId: string;
  onWorkerSelect: (workerId: string) => void;
  placeholder?: string;
}

const WorkerSearchSelect: React.FC<WorkerSearchSelectProps> = ({
  workers,
  selectedWorkerId,
  onWorkerSelect,
  placeholder = "Buscar trabajador...",
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [inputValue, setInputValue] = useState("");
  const dropdownRef = useRef<HTMLDivElement>(null);

  const selectedWorker = workers.find((w) => w.id === selectedWorkerId);

  // Filter workers based on search
  const filteredWorkers = workers
    .filter(
      (worker) =>
        worker.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        worker.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (worker.phone &&
          worker.phone.toLowerCase().includes(searchQuery.toLowerCase())) ||
        (worker.department &&
          worker.department
            .toLowerCase()
            .includes(searchQuery.toLowerCase())) ||
        (worker.position &&
          worker.position.toLowerCase().includes(searchQuery.toLowerCase()))
    )
    .sort((a, b) =>
      a.name.localeCompare(b.name, "es", { sensitivity: "base" })
    );

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
        // Si hay un trabajador seleccionado, mostrar su nombre, sino limpiar
        if (selectedWorker) {
          setInputValue(selectedWorker.name);
        } else {
          setInputValue("");
        }
        setSearchQuery("");
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Actualizar el valor del input cuando cambia el trabajador seleccionado
  useEffect(() => {
    if (selectedWorker) {
      setInputValue(selectedWorker.name);
    } else {
      setInputValue("");
    }
  }, [selectedWorker]);
  const handleWorkerSelect = (worker: Worker) => {
    onWorkerSelect(worker.id);
    setInputValue(worker.name);
    setIsOpen(false);
    setSearchQuery("");
  };

  const handleClear = (e: React.MouseEvent) => {
    e.stopPropagation();
    onWorkerSelect("");
    setInputValue("");
    setSearchQuery("");
    setIsOpen(false);
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setInputValue(value);
    setSearchQuery(value);
    setIsOpen(true);

    // Si se borra todo el contenido, deseleccionar trabajador
    if (value === "") {
      onWorkerSelect("");
    }
  };

  const handleInputFocus = () => {
    setIsOpen(true);
    // Si hay un trabajador seleccionado, limpiar para permitir búsqueda
    if (selectedWorker) {
      setInputValue("");
      setSearchQuery("");
    }
  };

  const handleInputClick = () => {
    setIsOpen(true);
  };

  return (
    <div className="relative" ref={dropdownRef}>
      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
        Trabajador
      </label>

      {/* Input Field */}
      <div
        className={`
          min-h-[42px] bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 
          rounded-md flex items-center
          hover:border-gray-400 dark:hover:border-gray-500
          ${isOpen ? "border-blue-500 ring-1 ring-blue-500" : ""}
        `}
      >
        <div className="flex-1 flex items-center px-3 py-2">
          <Search size={18} className="text-gray-400 mr-2" />
          <input
            type="text"
            value={inputValue}
            onChange={handleInputChange}
            onFocus={handleInputFocus}
            onClick={handleInputClick}
            placeholder={placeholder}
            className="flex-1 bg-transparent text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 focus:outline-none"
          />
        </div>
        <div className="flex items-center space-x-1">
          {(selectedWorker || inputValue) && (
            <button
              type="button"
              onClick={handleClear}
              className="p-1 mr-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded"
            >
              <X size={14} className="text-gray-400" />
            </button>
          )}
          <ChevronDown
            size={16}
            className={`text-gray-400 transition-transform duration-200 mr-2 ${
              isOpen ? "rotate-180" : ""
            }`}
            onClick={() => setIsOpen(!isOpen)}
          />
        </div>
      </div>

      {/* Dropdown */}
      {isOpen && (
        <div className="absolute z-50 w-full mt-1 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-md shadow-lg max-h-60 overflow-hidden">
          {/* Results */}
          <div className="max-h-48 overflow-y-auto">
            {filteredWorkers.length === 0 ? (
              <div className="px-3 py-4 text-center text-gray-500 dark:text-gray-400 text-sm">
                {searchQuery
                  ? `No se encontraron trabajadores con "${searchQuery}"`
                  : "Escribe para buscar trabajadores"}
              </div>
            ) : (
              <>
                {/* Results count */}
                <div className="px-3 py-2 text-xs text-gray-500 dark:text-gray-400 bg-gray-50 dark:bg-gray-700">
                  {searchQuery
                    ? `${filteredWorkers.length} de ${workers.length} trabajadores`
                    : `${workers.length} trabajadores disponibles`}
                </div>

                {/* Worker list */}
                {filteredWorkers.map((worker) => (
                  <div
                    key={worker.id}
                    className={`
                      px-3 py-3 cursor-pointer flex items-center justify-between border-b border-gray-100 dark:border-gray-700 last:border-b-0
                      hover:bg-gray-100 dark:hover:bg-gray-700
                      ${
                        selectedWorkerId === worker.id
                          ? "bg-blue-50 dark:bg-blue-900/20"
                          : ""
                      }
                    `}
                    onClick={() => handleWorkerSelect(worker)}
                  >
                    <div className="flex-1 min-w-0">
                      <p
                        className={`text-sm font-medium truncate ${
                          selectedWorkerId === worker.id
                            ? "text-blue-700 dark:text-blue-300"
                            : "text-gray-900 dark:text-white"
                        }`}
                      >
                        {worker.name}
                      </p>
                      <p className="text-xs text-gray-500 dark:text-gray-400 truncate">
                        {worker.email}
                      </p>
                      {(worker.department || worker.position) && (
                        <p className="text-xs text-gray-400 dark:text-gray-500 truncate">
                          {[worker.department, worker.position]
                            .filter(Boolean)
                            .join(" • ")}
                        </p>
                      )}
                    </div>
                    {selectedWorkerId === worker.id && (
                      <Check
                        size={16}
                        className="text-blue-600 dark:text-blue-400 ml-2"
                      />
                    )}
                  </div>
                ))}
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export const SalaryCalculatorPage: React.FC = () => {
  const { externalJwt } = useAuthStore();

  // All workers from API (cached in memory)
  const [allWorkers, setAllWorkers] = useState<Worker[]>([]);
  // Filtered workers based on search
  const [workers, setWorkers] = useState<Worker[]>([]);
  const [selectedWorkerId, setSelectedWorkerId] = useState("");
  const [selectedWorker, setSelectedWorker] = useState<Worker | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isCalculating, setIsCalculating] = useState(false);
  const [lastFetchTime, setLastFetchTime] = useState<Date | null>(null);

  // Calculation form data
  const [calculationData, setCalculationData] = useState({
    baseSalary: "",
    hoursWorked: "",
    overtimeHours: "",
    bonuses: "",
    deductions: "",
    period: "monthly",
    notes: "",
  });

  // Calculation results
  const [results, setResults] = useState<{
    grossSalary: number;
    netSalary: number;
    taxes: number;
    socialSecurity: number;
  } | null>(null);

  useEffect(() => {
    fetchAllWorkers();
  }, []);

  useEffect(() => {
    if (selectedWorkerId) {
      const worker = workers.find((w) => w.id === selectedWorkerId);
      setSelectedWorker(worker || null);

      // Pre-fill with worker's base salary if available
      if (worker?.baseSalary) {
        setCalculationData((prev) => ({
          ...prev,
          baseSalary: worker.baseSalary.toString(),
        }));
      }
    } else {
      setSelectedWorker(null);
    }
  }, [selectedWorkerId, workers]);

  const fetchAllWorkers = async () => {
    setIsLoading(true);
    try {
      if (!externalJwt) {
        console.error("No JWT token available");
        return;
      }

      const apiUrl = import.meta.env.VITE_API_BASE_URL;
      if (!apiUrl) {
        console.error("API URL not configured");
        return;
      }

      console.log("Fetching all workers from API...");

      const response = await fetch(
        `${apiUrl}/parameter/list?types[0]=5&types[1]=4&situation=0`,
        {
          method: "GET",
          headers: {
            Authorization: `Bearer ${externalJwt}`,
            "Content-Type": "application/json",
            Accept: "application/json",
          },
        }
      );

      if (!response.ok) {
        throw new Error(
          `Error fetching workers: ${response.status} - ${response.statusText}`
        );
      }

      const workersData = await response.json();
      console.log(`Fetched ${workersData.length} workers from API`);

      // Transform API data to match our Worker interface
      const transformedWorkers: Worker[] = workersData.map(
        (apiWorker: any) => ({
          id:
            apiWorker.id ||
            apiWorker.workerId ||
            Math.random().toString(36).substr(2, 9),
          name: apiWorker.name || apiWorker.fullName || "Nombre no disponible",
          email: apiWorker.email || "email@example.com",
          role: apiWorker.role || "tecnico",
          phone: apiWorker.phone || apiWorker.phoneNumber || null,
          createdAt:
            apiWorker.createdAt ||
            apiWorker.dateCreated ||
            new Date().toISOString(),
          updatedAt: apiWorker.updatedAt || apiWorker.dateModified || null,
          avatarUrl: apiWorker.avatarUrl || apiWorker.profileImage || null,
          baseSalary: apiWorker.baseSalary || apiWorker.salary || 0,
          hourlyRate: apiWorker.hourlyRate || apiWorker.hourRate || 0,
          contractType: apiWorker.contractType || "full_time",
          department: apiWorker.department || apiWorker.area || "",
          position: apiWorker.position || apiWorker.jobTitle || "",
          companies: Array.isArray(apiWorker.parameterRelations)
            ? apiWorker.parameterRelations
                .map(
                  (relation: any) => relation.companyName || relation.name || ""
                )
                .filter(
                  (name: string) =>
                    typeof name === "string" && name.trim().length > 0
                )
                .join(", ") || null
            : null,
        })
      );

      setAllWorkers(transformedWorkers);
      setWorkers(
        transformedWorkers.sort((a, b) =>
          a.name.localeCompare(b.name, "es", { sensitivity: "base" })
        )
      );
      setLastFetchTime(new Date());

      // Store in localStorage for offline access
      localStorage.setItem(
        "cached_workers",
        JSON.stringify({
          data: transformedWorkers,
          timestamp: new Date().toISOString(),
        })
      );
    } catch (error) {
      console.error("Error fetching workers from API:", error);

      // Try to load from localStorage as fallback
      const cachedData = localStorage.getItem("cached_workers");
      if (cachedData) {
        try {
          const parsed = JSON.parse(cachedData);
          const sortedData = (parsed.data || []).sort((a, b) =>
            a.name.localeCompare(b.name, "es", { sensitivity: "base" })
          );
          setAllWorkers(sortedData);
          setWorkers(sortedData);
          setLastFetchTime(new Date(parsed.timestamp));
          console.log("Loaded workers from cache");
        } catch (cacheError) {
          console.error("Error loading cached workers:", cacheError);
        }
      }
    } finally {
      setIsLoading(false);
    }
  };

  const refreshWorkers = async () => {
    setIsRefreshing(true);
    await fetchAllWorkers();
    setIsRefreshing(false);
  };

  const calculateSalary = () => {
    const baseSalary = parseFloat(calculationData.baseSalary) || 0;
    const hoursWorked = parseFloat(calculationData.hoursWorked) || 0;
    const overtimeHours = parseFloat(calculationData.overtimeHours) || 0;
    const bonuses = parseFloat(calculationData.bonuses) || 0;
    const deductions = parseFloat(calculationData.deductions) || 0;

    // Basic calculation logic (can be customized based on your needs)
    const regularPay = baseSalary;
    const overtimePay = overtimeHours * (baseSalary / 160) * 1.5; // Assuming 160 hours/month, 1.5x overtime
    const grossSalary = regularPay + overtimePay + bonuses;

    // Tax calculations (simplified - adjust based on your tax rules)
    const taxRate = 0.21; // 21% tax rate
    const socialSecurityRate = 0.063; // 6.3% social security

    const taxes = grossSalary * taxRate;
    const socialSecurity = grossSalary * socialSecurityRate;
    const netSalary = grossSalary - taxes - socialSecurity - deductions;

    setResults({
      grossSalary,
      netSalary,
      taxes,
      socialSecurity,
    });
  };

  const handleCalculate = async () => {
    if (!selectedWorker) {
      alert("Por favor selecciona un trabajador");
      return;
    }

    setIsCalculating(true);
    try {
      calculateSalary();

      // Optionally save calculation to local storage
      // localStorage.setItem('lastCalculation', JSON.stringify(results));
    } catch (error) {
      console.error("Error calculating salary:", error);
      alert("Error al calcular el sueldo");
    } finally {
      setIsCalculating(false);
    }
  };

  const resetCalculation = () => {
    setCalculationData({
      baseSalary: "",
      hoursWorked: "",
      overtimeHours: "",
      bonuses: "",
      deductions: "",
      period: "monthly",
      notes: "",
    });
    setResults(null);
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("es-ES", {
      style: "currency",
      currency: "EUR",
    }).format(amount);
  };

  return (
    <div className="space-y-6 w-full max-w-full min-w-0">
      <PageHeader
        title="Calculadora de Sueldos"
        description="Calcula sueldos individuales de trabajadores"
        actionLabel="Limpiar"
        onAction={resetCalculation}
        actionIcon={<Calculator size={18} />}
      />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Worker Selection and Input Form */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center">
                <User
                  size={20}
                  className="mr-2 text-blue-600 dark:text-blue-400"
                />
                Selección de Trabajador
              </h2>
              <Button
                size="sm"
                variant="outline"
                onClick={refreshWorkers}
                disabled={isRefreshing}
                leftIcon={
                  <RefreshCw
                    size={16}
                    className={isRefreshing ? "animate-spin" : ""}
                  />
                }
              >
                Actualizar
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Data Status */}
            {lastFetchTime && (
              <div className="text-xs text-gray-500 dark:text-gray-400 bg-gray-50 dark:bg-gray-800 p-2 rounded">
                Datos actualizados: {lastFetchTime.toLocaleString("es-ES")}
              </div>
            )}

            {/* Combined Search and Select */}
            {isLoading ? (
              <div className="flex items-center justify-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-blue-500"></div>
                <span className="ml-2 text-gray-600 dark:text-gray-400">
                  Cargando trabajadores...
                </span>
              </div>
            ) : (
              <WorkerSearchSelect
                workers={allWorkers}
                selectedWorkerId={selectedWorkerId}
                onWorkerSelect={setSelectedWorkerId}
                placeholder="Buscar y seleccionar trabajador..."
              />
            )}

            {/* Selected Worker Info */}
            {selectedWorker && (
              <div className="p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-700">
                <h3 className="font-medium text-blue-900 dark:text-blue-100 mb-2">
                  {selectedWorker.name}
                </h3>
                <div className="text-sm text-blue-700 dark:text-blue-300 space-y-1">
                  <p>Email: {selectedWorker.email}</p>
                  {selectedWorker.phone && (
                    <p>Teléfono: {selectedWorker.phone}</p>
                  )}
                  {selectedWorker.department && (
                    <p>Departamento: {selectedWorker.department}</p>
                  )}
                  {selectedWorker.position && (
                    <p>Posición: {selectedWorker.position}</p>
                  )}
                  {selectedWorker.companies && (
                    <p>Empresas: {selectedWorker.companies}</p>
                  )}
                  {selectedWorker.baseSalary && (
                    <p>
                      Sueldo Base: {formatCurrency(selectedWorker.baseSalary)}
                    </p>
                  )}
                </div>
              </div>
            )}

            {/* Calculation Form */}
            <div className="space-y-4 pt-4 border-t border-gray-200 dark:border-gray-700">
              <h3 className="font-medium text-gray-900 dark:text-white">
                Datos para Cálculo
              </h3>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Input
                  type="number"
                  label="Sueldo Base (€)"
                  value={calculationData.baseSalary}
                  onChange={(e) =>
                    setCalculationData((prev) => ({
                      ...prev,
                      baseSalary: e.target.value,
                    }))
                  }
                  placeholder="1500"
                  fullWidth
                />

                <Select
                  label="Período"
                  value={calculationData.period}
                  onChange={(value) =>
                    setCalculationData((prev) => ({ ...prev, period: value }))
                  }
                  options={[
                    { value: "monthly", label: "Mensual" },
                    { value: "weekly", label: "Semanal" },
                    { value: "daily", label: "Diario" },
                  ]}
                  fullWidth
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Input
                  type="number"
                  label="Horas Trabajadas"
                  value={calculationData.hoursWorked}
                  onChange={(e) =>
                    setCalculationData((prev) => ({
                      ...prev,
                      hoursWorked: e.target.value,
                    }))
                  }
                  placeholder="160"
                  fullWidth
                />

                <Input
                  type="number"
                  label="Horas Extra"
                  value={calculationData.overtimeHours}
                  onChange={(e) =>
                    setCalculationData((prev) => ({
                      ...prev,
                      overtimeHours: e.target.value,
                    }))
                  }
                  placeholder="0"
                  fullWidth
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Input
                  type="number"
                  label="Bonificaciones (€)"
                  value={calculationData.bonuses}
                  onChange={(e) =>
                    setCalculationData((prev) => ({
                      ...prev,
                      bonuses: e.target.value,
                    }))
                  }
                  placeholder="0"
                  fullWidth
                />

                <Input
                  type="number"
                  label="Deducciones (€)"
                  value={calculationData.deductions}
                  onChange={(e) =>
                    setCalculationData((prev) => ({
                      ...prev,
                      deductions: e.target.value,
                    }))
                  }
                  placeholder="0"
                  fullWidth
                />
              </div>

              <Input
                label="Notas"
                value={calculationData.notes}
                onChange={(e) =>
                  setCalculationData((prev) => ({
                    ...prev,
                    notes: e.target.value,
                  }))
                }
                placeholder="Notas adicionales..."
                fullWidth
              />

              <Button
                onClick={handleCalculate}
                disabled={!selectedWorker || !calculationData.baseSalary}
                isLoading={isCalculating}
                leftIcon={<Calculator size={18} />}
                className="w-full"
              >
                Calcular Sueldo
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Results */}
        <Card>
          <CardHeader>
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center">
              <DollarSign
                size={20}
                className="mr-2 text-green-600 dark:text-green-400"
              />
              Resultados del Cálculo
            </h2>
          </CardHeader>
          <CardContent>
            {!results ? (
              <div className="text-center py-8">
                <Calculator size={48} className="mx-auto text-gray-400 mb-4" />
                <p className="text-gray-500 dark:text-gray-400">
                  Selecciona un trabajador y completa los datos para ver los
                  resultados
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                {selectedWorker && (
                  <div className="text-center mb-6">
                    <h3 className="text-xl font-bold text-gray-900 dark:text-white">
                      {selectedWorker.name}
                    </h3>
                    <p className="text-sm text-gray-500 dark:text-gray-400">
                      Cálculo{" "}
                      {calculationData.period === "monthly"
                        ? "mensual"
                        : calculationData.period === "weekly"
                        ? "semanal"
                        : "diario"}
                    </p>
                  </div>
                )}

                <div className="space-y-3">
                  <div className="flex justify-between items-center p-3 bg-green-50 dark:bg-green-900/20 rounded-lg">
                    <span className="font-medium text-green-800 dark:text-green-300">
                      Sueldo Bruto
                    </span>
                    <span className="text-xl font-bold text-green-900 dark:text-green-100">
                      {formatCurrency(results.grossSalary)}
                    </span>
                  </div>

                  <div className="flex justify-between items-center p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
                    <span className="font-medium text-blue-800 dark:text-blue-300">
                      Sueldo Neto
                    </span>
                    <span className="text-xl font-bold text-blue-900 dark:text-blue-100">
                      {formatCurrency(results.netSalary)}
                    </span>
                  </div>

                  <div className="space-y-2 pt-4 border-t border-gray-200 dark:border-gray-700">
                    <h4 className="font-medium text-gray-900 dark:text-white">
                      Desglose:
                    </h4>

                    <div className="flex justify-between text-sm">
                      <span className="text-gray-600 dark:text-gray-400">
                        Impuestos (21%)
                      </span>
                      <span className="text-red-600 dark:text-red-400">
                        -{formatCurrency(results.taxes)}
                      </span>
                    </div>

                    <div className="flex justify-between text-sm">
                      <span className="text-gray-600 dark:text-gray-400">
                        Seguridad Social (6.3%)
                      </span>
                      <span className="text-red-600 dark:text-red-400">
                        -{formatCurrency(results.socialSecurity)}
                      </span>
                    </div>

                    {parseFloat(calculationData.deductions) > 0 && (
                      <div className="flex justify-between text-sm">
                        <span className="text-gray-600 dark:text-gray-400">
                          Otras Deducciones
                        </span>
                        <span className="text-red-600 dark:text-red-400">
                          -
                          {formatCurrency(
                            parseFloat(calculationData.deductions)
                          )}
                        </span>
                      </div>
                    )}

                    {parseFloat(calculationData.bonuses) > 0 && (
                      <div className="flex justify-between text-sm">
                        <span className="text-gray-600 dark:text-gray-400">
                          Bonificaciones
                        </span>
                        <span className="text-green-600 dark:text-green-400">
                          +{formatCurrency(parseFloat(calculationData.bonuses))}
                        </span>
                      </div>
                    )}
                  </div>

                  {/* Summary Card */}
                  <div className="mt-6 p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
                    <h4 className="font-medium text-gray-900 dark:text-white mb-3">
                      Resumen:
                    </h4>
                    <div className="grid grid-cols-2 gap-4 text-sm">
                      <div>
                        <span className="text-gray-600 dark:text-gray-400">
                          Horas Regulares:
                        </span>
                        <p className="font-medium">
                          {calculationData.hoursWorked || "0"}
                        </p>
                      </div>
                      <div>
                        <span className="text-gray-600 dark:text-gray-400">
                          Horas Extra:
                        </span>
                        <p className="font-medium">
                          {calculationData.overtimeHours || "0"}
                        </p>
                      </div>
                      <div>
                        <span className="text-gray-600 dark:text-gray-400">
                          Período:
                        </span>
                        <p className="font-medium capitalize">
                          {calculationData.period === "monthly"
                            ? "Mensual"
                            : calculationData.period === "weekly"
                            ? "Semanal"
                            : "Diario"}
                        </p>
                      </div>
                      <div>
                        <span className="text-gray-600 dark:text-gray-400">
                          Fecha:
                        </span>
                        <p className="font-medium">
                          {formatDate(new Date().toISOString())}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Quick Actions */}
      {results && (
        <Card>
          <CardContent className="p-4">
            <div className="flex flex-wrap gap-3">
              <Button
                variant="outline"
                leftIcon={<FileText size={16} />}
                onClick={() => {
                  // TODO: Generate PDF report
                  alert("Función de exportar PDF próximamente");
                }}
              >
                Exportar PDF
              </Button>

              <Button
                variant="outline"
                leftIcon={<Calculator size={16} />}
                onClick={() => {
                  // TODO: Save calculation
                  alert("Función de guardar cálculo próximamente");
                }}
              >
                Guardar Cálculo
              </Button>

              <Button variant="outline" onClick={resetCalculation}>
                Nuevo Cálculo
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};
