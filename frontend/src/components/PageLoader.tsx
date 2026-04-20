
import { motion } from 'framer-motion';

interface PageLoaderProps {
    message?: string;
}

export function PageLoader({ message = "Loading..." }: PageLoaderProps) {
    return (
        <div className="flex justify-center items-center h-screen bg-gray-50 dark:bg-gray-900">
            <motion.div
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                className="flex flex-col items-center gap-6"
            >
                {/* Adani-branded spinner */}
                <div className="relative">
                    <div className="w-16 h-16 rounded-full border-4 border-gray-200 dark:border-gray-700"></div>
                    <div className="absolute top-0 left-0 w-16 h-16 rounded-full border-4 border-transparent border-t-[#00A86B] animate-spin"></div>
                </div>

                {/* Loading message */}
                <p className="text-gray-500 dark:text-gray-400 font-bold uppercase tracking-widest text-sm animate-pulse">
                    {message}
                </p>
            </motion.div>
        </div>
    );
}
