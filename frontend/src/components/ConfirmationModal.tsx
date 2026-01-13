import { useEffect, useRef } from "react";
import { createPortal } from "react-dom";

interface ConfirmationModalProps {
    isOpen: boolean;
    onClose: () => void;
    onConfirm?: () => void;
    title: string;
    message: React.ReactNode;
    type?: "success" | "danger" | "warning" | "info";
    confirmText?: string;
    cancelText?: string;
    isAlert?: boolean; // If true, only shows one button (OK)
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
    isAlert = false,
}: ConfirmationModalProps) {
    const modalRef = useRef<HTMLDivElement>(null);

    // Keyboard Shortcuts: Escape (Close), Enter (Confirm)
    useEffect(() => {
        const handleKeyDown = (event: KeyboardEvent) => {
            if (event.key === "Escape") {
                onClose();
            } else if (event.key === "Enter" && onConfirm) {
                // Prevent default behavior to avoid accidental duplicate submissions if focus is on button
                event.preventDefault();
                onConfirm();
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
    }, [isOpen, onClose, onConfirm]);

    if (!isOpen) return null;

    // Define colors/icons based on type
    const styles = {
        success: {
            iconBg: "bg-green-100",
            iconColor: "text-green-600",
            icon: "check_circle",
            buttonBg: "bg-green-600 hover:bg-green-700",
        },
        danger: {
            iconBg: "bg-red-100",
            iconColor: "text-red-600",
            icon: "error",
            buttonBg: "bg-red-600 hover:bg-red-700",
        },
        warning: {
            iconBg: "bg-orange-100",
            iconColor: "text-orange-600",
            icon: "warning",
            buttonBg: "bg-orange-600 hover:bg-orange-700",
        },
        info: {
            iconBg: "bg-blue-100",
            iconColor: "text-blue-600",
            icon: "info",
            buttonBg: "bg-blue-600 hover:bg-blue-700",
        },
    };

    const currentStyle = styles[type];

    return createPortal(
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4">
            {/* Backdrop */}
            <div
                className="absolute inset-0 bg-gray-900/40 backdrop-blur-sm transition-opacity"
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
                        <span className={`material-symbols-rounded text-2xl ${currentStyle.iconColor}`}>
                            {currentStyle.icon}
                        </span>
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
                        {!isAlert && (
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
