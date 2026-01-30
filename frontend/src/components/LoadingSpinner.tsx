
interface LoadingSpinnerProps {
    message?: string;
    subMessage?: string;
    fullScreen?: boolean;
}

export default function LoadingSpinner({
    message = "Carregando...",
    subMessage,
    fullScreen = true
}: LoadingSpinnerProps) {
    return (
        <div className={`flex flex-col items-center justify-center z-50 transition-all duration-500 ${fullScreen ? 'fixed inset-0 bg-white/30 backdrop-blur-md' : 'h-full py-12 w-full'
            }`}>
            <div className="relative flex flex-col items-center">
                {/* Modern Spinning Ring */}
                <div className="relative w-16 h-16">
                    <div className="absolute inset-0 rounded-full border-4 border-gray-200/50"></div>
                    <div className="absolute inset-0 rounded-full border-4 border-blue-600 border-t-transparent animate-spin"></div>
                    {/* Inner pulse circle */}
                    <div className="absolute inset-4 rounded-full bg-blue-500/10 animate-pulse"></div>
                </div>

                {/* Text animation */}
                <div className="mt-6 text-center space-y-2">
                    <h2 className="text-lg font-bold text-gray-800 animate-pulse tracking-wide">
                        {message}
                    </h2>
                    {subMessage && (
                        <p className="text-xs text-gray-500 font-medium">
                            {subMessage}
                        </p>
                    )}
                </div>
            </div>
        </div>
    );
}
