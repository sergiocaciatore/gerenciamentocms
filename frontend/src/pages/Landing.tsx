import React from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';

const Landing: React.FC = () => {
  const navigate = useNavigate();

  const containerVariants = {
    hidden: { opacity: 0 },
    visible: { 
      opacity: 1,
      transition: { 
        staggerChildren: 0.1,
        delayChildren: 0.2
      }
    }
  };

  const itemVariants = {
    hidden: { scale: 0, opacity: 0 },
    visible: { 
      scale: 1, 
      opacity: 1,
      transition: { 
        type: "spring" as const,
        stiffness: 260,
        damping: 20
      }
    }
  };

  return (
    <div className="min-h-screen bg-[url('/slide01.jpg')] bg-cover bg-center bg-no-repeat flex flex-col items-center justify-center relative overflow-hidden">
      
      {/* Dark Overlay */}
      <div className="absolute inset-0 bg-black/30" />
      
      {/* Central Navigation Cluster (Apple Watch Style) */}
      <motion.div 
        className="flex flex-wrap gap-8 items-center justify-center z-10 max-w-7xl px-4"
        variants={containerVariants}
        initial="hidden"
        animate="visible"
      >
        {[
          { name: "Residentes", src: "/cms.svg", path: "/rd" },
          { name: "Mercado Livre", src: "/MERCADOLIVRE.png", path: "/mercadolivre/login" },
          { name: "Amazon", src: "/AMAZON.png", path: "/amazon" },
          { name: "Shopee", src: "/SHOPEE.png", path: "/login" },
          { name: "Drogasil", src: "/DROGASIL.png", path: "/login" },
          { name: "Renner", src: "/RENNER.png", path: "/login" },
          { name: "Riachuelo", src: "/RIACHUELO.png", path: "/login" },
          { name: "Cencosud", src: "/CENCOSUD.png", path: "/login" },
          { name: "Volvo", src: "/VOLVO.png", path: "/login" },
          { name: "GLP", src: "/GLP.png", path: "/login" },
          { name: "Prologis", src: "/PROLOGIS.png", path: "/login" },
          { name: "Multilog", src: "/MULTILOG.png", path: "/login" },
          { name: "Barzel", src: "/BARZEL.png", path: "/login" },
          { name: "Newport", src: "/NEWPORT.png", path: "/login" },
        ].map((item) => (
            <motion.button
                key={item.name}
                variants={itemVariants}
                onClick={() => navigate(item.path)}
                whileHover={{ scale: 1.1 }}
                whileTap={{ scale: 0.95 }}
                className="group flex flex-col items-center gap-4 cursor-pointer relative hover:z-50"
            >
                <div className="w-24 h-24 md:w-32 md:h-32 rounded-full bg-white flex items-center justify-center shadow-[0_8px_30px_rgb(0,0,0,0.12)] group-hover:shadow-[0_20px_40px_rgba(0,0,0,0.2)] transition-all duration-300 overflow-hidden p-5 z-10 relative">
                    <img 
                        src={item.src} 
                        alt={item.name} 
                        className="w-full h-full object-contain opacity-90 group-hover:opacity-100 transition-opacity"
                    />
                </div>
                
                {/* Tooltip */}
                <span className="opacity-0 group-hover:opacity-100 transition-opacity duration-300 absolute -bottom-8 bg-black/70 text-white text-xs px-2 py-1 rounded whitespace-nowrap pointer-events-none">
                    {item.name}
                </span>
            </motion.button>
        ))}
      </motion.div>

      {/* Logo Positioned Bottom Left */}
      <motion.div 
        initial={{ opacity: 0, scale: 0.8 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ delay: 0.5, duration: 0.8 }}
        className="fixed top-4 right-4 md:top-6 md:right-6 opacity-90 hover:opacity-100 transition-opacity"
      >
        <div className="w-40 h-40 md:w-64 md:h-64">
            <img 
                src="/cms.svg" 
                alt="CMS Logo" 
                className="w-full h-full object-contain"
            />
        </div>
      </motion.div>

    </div>
  );
};

export default Landing;
