import { useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { ExclamationTriangleIcon, CheckCircleIcon, InformationCircleIcon } from "@heroicons/react/24/outline";

interface ConfirmationModalProps {
    isOpen: boolean;
    onClose: () => void;
    onConfirm?: () => void;
    title: string;
    message: React.ReactNode;
    type?: "success" | "danger" | "warning" | "info";
    confirmText?: string;
    cancelText?: string;
    singleButton?: boolean; 
}

export default function ConfirmationModal({
    isOpen,
    onClose,
    onConfirm,
    title,
    message,
    type = "info",
    confirmText = "Confirmar",
    cancelText = "Cancelar",
    singleButton = false,
}: ConfirmationModalProps) {
    const modalRef = useRef<HTMLDivElement>(null);

    // Keyboard shortcuts: Esc (Close), Enter (Confirm)
    useEffect(() => {
        const handleKeyDown = (event: KeyboardEvent) => {
            if (event.key === "Escape") {
                onClose();
            } else if (event.key === "Enter" && onConfirm && !singleButton) {
                event.preventDefault();
                onConfirm();
                onClose();
            } else if (event.key === "Enter" && singleButton) {
                event.preventDefault();
                onClose();
            }
        };

        if (isOpen) {
            document.addEventListener("keydown", handleKeyDown);
            document.body.style.overflow = "hidden";
        }
        return () => {
            document.removeEventListener("keydown", handleKeyDown);
            document.body.style.overflow = "unset";
        };
    }, [isOpen, onClose, onConfirm, singleButton]);

    if (!isOpen) return null;

    const styles = {
        success: {
            iconBg: "bg-green-100",
            iconColor: "text-green-600",
            icon: <CheckCircleIcon className="h-6 w-6 text-green-600" aria-hidden="true" />,
            buttonBg: "bg-green-600 hover:bg-green-700 focus:ring-green-500",
        },
        danger: {
            iconBg: "bg-red-100",
            iconColor: "text-red-600",
            icon: <ExclamationTriangleIcon className="h-6 w-6 text-red-600" aria-hidden="true" />,
            buttonBg: "bg-red-600 hover:bg-red-700 focus:ring-red-500",
        },
        warning: {
            iconBg: "bg-yellow-100",
            iconColor: "text-yellow-600",
            icon: <ExclamationTriangleIcon className="h-6 w-6 text-yellow-600" aria-hidden="true" />,
            buttonBg: "bg-yellow-600 hover:bg-yellow-700 focus:ring-yellow-500",
        },
        info: {
            iconBg: "bg-blue-100",
            iconColor: "text-blue-600",
            icon: <InformationCircleIcon className="h-6 w-6 text-blue-600" aria-hidden="true" />,
            buttonBg: "bg-blue-600 hover:bg-blue-700 focus:ring-blue-500",
        },
    };

    const currentStyle = styles[type];

    return createPortal(
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4">
            {/* Backdrop */}
            <div
                className="absolute inset-0 bg-gray-900/50 backdrop-blur-sm transition-opacity"
                onClick={onClose}
            ></div>

            {/* Modal Content */}
            <div
                ref={modalRef}
                className="relative w-full max-w-sm transform overflow-hidden rounded-2xl bg-white p-6 shadow-2xl transition-all animate-bounce-in"
            >
                <div className="flex flex-col items-center text-center">
                    {/* Icon */}
                    <div className={`mb-4 flex h-12 w-12 items-center justify-center rounded-full ${currentStyle.iconBg}`}>
                        {currentStyle.icon}
                    </div>

                    {/* Text */}
                    <h3 className="mb-2 text-lg font-bold text-gray-900 leading-tight">
                        {title}
                    </h3>
                    <div className="mb-6 text-sm text-gray-500">
                        {message}
                    </div>

                    {/* Buttons */}
                    <div className="flex w-full gap-3">
                        {!singleButton && (
                            <button
                                onClick={onClose}
                                className="flex-1 rounded-xl bg-gray-100 px-4 py-2.5 text-sm font-semibold text-gray-700 hover:bg-gray-200 focus:outline-none transition-colors"
                            >
                                {cancelText}
                            </button>
                        )}
                        <button
                            onClick={() => {
                                if (onConfirm) onConfirm();
                                onClose();
                            }}
                            className={`flex-1 rounded-xl px-4 py-2.5 text-sm font-semibold text-white shadow-sm focus:outline-none transition-all active:scale-95 ${currentStyle.buttonBg}`}
                        >
                            {confirmText}
                        </button>
                    </div>
                </div>
            </div>
        </div>,
        document.body
    );
}
