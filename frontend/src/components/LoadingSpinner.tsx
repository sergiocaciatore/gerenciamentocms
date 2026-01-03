
interface LoadingSpinnerProps {
    message?: string;
    subMessage?: string;
    fullScreen?: boolean;
}

export default function LoadingSpinner({
    message = "Carregando dados...",
    subMessage = "Aguarde enquanto carregamos as informações.",
    fullScreen = true
}: LoadingSpinnerProps) {
    return (
        <div className={`flex flex-col items-center justify-center ${fullScreen ? 'min-h-screen' : 'h-full py-12'}`}>
            <div className="relative flex items-center justify-center">
                <div className="w-16 h-16 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin"></div>
                <div className="absolute inset-0 flex items-center justify-center">
                    <div className="w-8 h-8 border-4 border-indigo-100 border-t-indigo-500 rounded-full animate-spin" style={{ animationDirection: 'reverse' }}></div>
                </div>
            </div>
            <h2 className="mt-4 text-xl font-semibold text-gray-700 animate-pulse">{message}</h2>
            <p className="text-sm text-gray-500 mt-2">{subMessage}</p>
        </div>
    );
}
