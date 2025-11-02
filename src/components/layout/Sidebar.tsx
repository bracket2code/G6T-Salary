import React from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import {
  LayoutGrid,
  Calculator,
  Users,
  Clock,
  LogOut,
  Landmark,
  BarChart2,
  Search,
  FileText,
} from "lucide-react";
import { ThemeToggle } from "./ThemeToggle";
import { useAuthStore } from "../../store/authStore";
import { useSidebarStore } from "../../store/sidebarStore";
import { Avatar } from "../ui/Avatar";

const isMobile = () => window.innerWidth < 768;

export const Sidebar: React.FC = () => {
  const { user, logout } = useAuthStore();
  const { isOpen, close } = useSidebarStore();
  const navigate = useNavigate();
  const location = useLocation();

  const handleNavigation = () => {
    if (isMobile()) {
      close();
    }
  };

  const handleLogout = async () => {
    await logout();
    navigate("/login");
  };

  if (!user) return null;

  const isActive = (path: string) => location.pathname === path;

  const navigationItems = [
    { path: "/", icon: LayoutGrid, label: "Dashboard" },
    { path: "/hours", icon: Clock, label: "Registro" },
    { path: "/calculator", icon: Calculator, label: "Cálculo Individual" },
    { path: "/multiple", icon: Users, label: "Cálculo Múltiple" },
    { path: "/queries", icon: Search, label: "Consultas" },
    { path: "/reports", icon: BarChart2, label: "Informes" },
    { path: "/templates", icon: FileText, label: "Plantillas PDF" },
  ];

  return (
    <div className="h-full bg-white dark:bg-dark-800 border-r border-gray-200 dark:border-dark-600 flex flex-col transition-all duration-200 shadow-lg md:shadow-none">
      {/* Header */}
      <div className="h-16 flex items-center px-4 border-b border-gray-200 dark:border-dark-600">
        <div
          className={`${
            isOpen
              ? "flex items-center"
              : "w-full flex items-center justify-center"
          }`}
        >
          <Landmark size={24} className="text-blue-600 dark:text-blue-400" />
          <span
            className={`font-semibold text-gray-900 dark:text-white transition-all duration-200 ${
              isOpen ? "ml-3 opacity-100" : "opacity-0 w-0 overflow-hidden ml-0"
            }`}
          >
            G6T-Salary
          </span>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-2 py-4 space-y-1 overflow-y-auto overflow-x-hidden">
        {navigationItems.map((item) => (
          <Link
            key={item.path}
            to={item.path}
            onClick={handleNavigation}
            className={`flex items-center px-3 py-2 text-sm font-medium rounded-md transition-all duration-200
              ${
                isActive(item.path)
                  ? "bg-blue-100 text-blue-900 dark:bg-blue-900 dark:text-blue-100"
                  : "text-gray-600 hover:bg-gray-50 hover:text-gray-900 dark:text-gray-300 dark:hover:bg-dark-700 dark:hover:text-white"
              }
            `}
          >
            <item.icon
              size={20}
              className={`flex-shrink-0 ${isOpen ? "mr-3" : ""}`}
            />
            <span
              className={`${
                isOpen ? "opacity-100 w-auto" : "opacity-0 w-0 md:hidden"
              } whitespace-nowrap transition-all duration-200`}
            >
              {item.label}
            </span>
          </Link>
        ))}
      </nav>

      {/* User section */}
      <div className="mt-auto border-t border-gray-200 dark:border-dark-600">
        {/* Icons row */}
        <div
          className={`p-3 ${
            isOpen
              ? "flex justify-between items-center"
              : "flex flex-col items-center space-y-3"
          }`}
        >
          <button
            onClick={handleLogout}
            className={`p-2 rounded-lg transition-all duration-200 ${"text-gray-600 hover:bg-red-50 hover:text-red-600 dark:text-gray-300 dark:hover:bg-red-900/20 dark:hover:text-red-400"}`}
            title="Cerrar sesión"
          >
            <LogOut size={18} />
          </button>

          <div className="flex items-center justify-center">
            <div
              className="cursor-pointer hover:opacity-80 transition-opacity"
              onClick={() => navigate("/profile")}
            >
              <Avatar name={user.name} size="sm" />
            </div>
          </div>

          <ThemeToggle />
        </div>

        {/* Copyright section */}
        {isOpen && (
          <div className="px-3 pb-3 text-center">
            <div className="text-xs text-gray-500 dark:text-gray-400">
              © 2025 Grupo6Tarifa.
            </div>
            <div className="text-xs text-gray-500 dark:text-gray-400">
              Todos los derechos reservados.
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
