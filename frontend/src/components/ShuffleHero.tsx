import React, { useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";

const ShuffleHero = () => {
    return (
        <section className="w-full min-h-[80vh] px-8 py-12 grid grid-cols-1 md:grid-cols-2 items-center gap-12 max-w-7xl mx-auto relative overflow-hidden">
            <div className="p-8 w-full z-10 flex flex-col justify-center">
                {/* Adani Logo */}
                <div className="mb-10">
                    <img
                        src={`${import.meta.env.BASE_URL}A1.jpg`}
                        alt="Adani"
                        className="h-20 w-auto object-contain drop-shadow-[0_0_15px_rgba(255,255,255,0.7)] dark:drop-shadow-[0_0_15px_rgba(0,0,0,0.5)]"
                        // Ensure logo fallback if A1.jpg is not a logo but a background, replace visually
                        onError={(e) => {
                            (e.target as HTMLImageElement).style.display = 'none';
                        }}
                    />
                </div>
                <h1 className="text-4xl md:text-5xl lg:text-6xl font-black mt-4 mb-4 text-gray-900 dark:text-white leading-[1.1] tracking-tight drop-shadow-md">
                    <span className="block text-transparent bg-clip-text bg-gradient-to-r from-[#0B74B0] via-[#75479C] to-[#BD3861]">Execution &</span>
                    <span className="block">Commissioning</span>
                    <span className="block text-gray-400 dark:text-gray-500">Tracker Portal</span>
                </h1>
                <div className="w-20 h-2 bg-gradient-to-r from-[#0B74B0] to-[#75479C] mt-6 rounded-full"></div>
            </div>
            <div className="w-full h-full flex items-center justify-center relative">
                {/* Add subtle glowing background blob to the shuffle grid */}
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[120%] h-[120%] bg-[#0B74B0]/10 dark:bg-[#0B74B0]/20 rounded-full blur-[80px] pointer-events-none -z-10"></div>
                <ShuffleGrid />
            </div>
        </section>
    );
};

const shuffle = (array: any[]) => {
    let currentIndex = array.length,
        randomIndex;

    while (currentIndex != 0) {
        randomIndex = Math.floor(Math.random() * currentIndex);
        currentIndex--;

        [array[currentIndex], array[randomIndex]] = [
            array[randomIndex],
            array[currentIndex],
        ];
    }

    return array;
};

const squareData = [
    ...Array(16).fill(null).map((_, i) => ({
        id: i + 1,
        src: `${import.meta.env.BASE_URL}A${i + 1}.jpg`
    }))
];

const generateSquares = (shuffledData: any[]) => {
    return shuffledData.map((sq: { id: number; src: string }) => (
        <motion.div
            key={sq.id}
            layout
            transition={{
                duration: 0.8,
                type: "spring",
                bounce: 0.15,
                stiffness: 200,
                damping: 20
            }}
            className="w-full h-full rounded-2xl overflow-hidden shadow-xl"
            style={{
                backgroundImage: `url(${sq.src})`,
                backgroundSize: "cover",
                backgroundPosition: "center",
            }}
            whileHover={{
                scale: 1.05,
                zIndex: 2,
                boxShadow: "0 20px 25px -5px rgba(0, 0, 0, 0.3), 0 10px 10px -5px rgba(0, 0, 0, 0.2)",
                transition: { duration: 0.3 }
            }}
            layoutId={`square-${sq.id}`}
        />
    ));
};

const ShuffleGrid = () => {
    const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const [shuffledData, setShuffledData] = useState<any[]>([]);

    useEffect(() => {
        // Initialize with shuffled data
        setShuffledData(shuffle([...squareData]));

        shuffleSquares();

        return () => {
            if (timeoutRef.current) {
                clearTimeout(timeoutRef.current);
            }
        };
    }, []);

    const shuffleSquares = () => {
        setShuffledData(prev => shuffle([...prev]));

        if (timeoutRef.current) {
            clearTimeout(timeoutRef.current);
        }
        timeoutRef.current = setTimeout(shuffleSquares, 4000); // slightly slower transitions 
    };

    return (
        <div className="grid grid-cols-4 grid-rows-4 h-[400px] md:h-[500px] lg:h-[550px] w-full max-w-lg gap-3 p-4 bg-white/30 dark:bg-gray-900/40 rounded-[2.5rem] backdrop-blur-sm border border-white/40 dark:border-gray-700/50 shadow-2xl">
            {generateSquares(shuffledData)}
        </div>
    );
};

export default ShuffleHero;
