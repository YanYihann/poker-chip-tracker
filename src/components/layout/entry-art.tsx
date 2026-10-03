"use client";

import { SimPokerCard } from "@/components/cards/sim-poker-card";
import { motion, useReducedMotion } from "framer-motion";

export function EntryArt() {
  const reduced = useReducedMotion();
  return <div className="entry-art" aria-hidden="true">
    {['TS','JS','QS','KS','AS'].map((card,index) => <motion.div key={card} className="entry-card" initial={reduced ? false : {y:36,rotate:0}} animate={{y:Math.abs(index-2)*14,rotate:(index-2)*12}} transition={{type:'spring',stiffness:260,damping:22,delay:index*.055}} style={{left:`${14+index*15}%`}}>
      <div className="entry-card-face"><SimPokerCard card={card} size="md" /></div>
    </motion.div>)}
  </div>;
}
