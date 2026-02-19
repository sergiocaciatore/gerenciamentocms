import { doc, runTransaction } from "firebase/firestore";
import { db } from "../firebase";

/**
 * Generates a sequential, formatted ID with concurrency safety using Firestore transactions.
 * e.g., AMZ-OBRA-0001, AMZ-RES-0001
 * 
 * @param prefix 'AMZ-OBRA' | 'AMZ-RES' | 'AMZ-FORN' | 'AMZ-COL'
 * @returns The generated formatted ID.
 */
export const generateSequentialId = async (prefix: string): Promise<string> => {
    const counterDocRef = doc(db, "AMZ_Counters", prefix);

    try {
        const newIdNumber = await runTransaction(db, async (transaction) => {
            const counterDoc = await transaction.get(counterDocRef);
            let currentCount = 0;

            if (counterDoc.exists()) {
                currentCount = counterDoc.data().count || 0;
            }

            const nextCount = currentCount + 1;
            
            // Write the new count back to the document
            transaction.set(counterDocRef, { count: nextCount }, { merge: true });

            return nextCount;
        });

        // Format to 4 digits (e.g., 0001, 0012, 0123)
        const formattedNumber = newIdNumber.toString().padStart(4, "0");
        return `${prefix}-${formattedNumber}`;

    } catch (error) {
        console.error("Error generating sequential ID for", prefix, error);
        throw new Error("Não foi possível gerar um ID sequencial seguro.");
    }
};
