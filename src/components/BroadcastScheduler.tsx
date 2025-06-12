import { useEffect, useRef } from 'react';
import { makeCall } from '@/lib/makeCall';
import { db } from '@/lib/firebase';
import { collection, updateDoc, doc, getDocs, query, where, Timestamp } from 'firebase/firestore';

interface ScheduledBroadcast {
  id: string;
  date: Timestamp;
  time: string;
  template: string;
  status: "scheduled" | "completed" | "cancelled";
  clientCount: number;
  dataSetId: string;
  data?: any[];
}

export const BroadcastScheduler = () => {
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  const checkScheduledBroadcasts = async () => {
    try {
      // Get current time
      const now = new Date();
      const currentTime = now.toLocaleTimeString('en-US', { 
        hour12: false, 
        hour: '2-digit', 
        minute: '2-digit' 
      });

      // Query Firestore for scheduled broadcasts
      const broadcastsRef = collection(db, 'scheduledBroadcasts');
      const q = query(
        broadcastsRef,
        where('status', '==', 'scheduled'),
        where('date', '<=', Timestamp.fromDate(now))
      );

      const querySnapshot = await getDocs(q);

      for (const broadcastDoc of querySnapshot.docs) {
        const broadcast = broadcastDoc.data() as ScheduledBroadcast;
        
        // Check if it's time to execute this broadcast
        const scheduledDate = broadcast.date.toDate();
        if (
          scheduledDate.getDate() === now.getDate() &&
          scheduledDate.getMonth() === now.getMonth() &&
          scheduledDate.getFullYear() === now.getFullYear() &&
          broadcast.time === currentTime
        ) {
          console.log(`Executing scheduled broadcast: ${broadcast.id}`);
          
          try {
            // Get the dataset
            const datasetRef = doc(db, 'datasets', broadcast.dataSetId);
            const datasetDoc = await getDocs(collection(datasetRef, 'data'));
            const contacts = datasetDoc.docs.map(doc => doc.data());

            // Execute calls for each contact
            for (const contact of contacts) {
              await makeCall({
                phoneNumber: contact.phoneNumber,
                firstName: contact.firstName,
                lastName: contact.lastName,
                fileNumber: contact.fileNumber,
                template: broadcast.template
              });
            }

            // Update broadcast status to completed
            await updateDoc(doc(broadcastsRef, broadcast.id), {
              status: 'completed'
            });

            console.log(`Broadcast ${broadcast.id} completed successfully`);
          } catch (error) {
            console.error(`Error executing broadcast ${broadcast.id}:`, error);
            
            // Update broadcast status to failed
            await updateDoc(doc(broadcastsRef, broadcast.id), {
              status: 'failed',
              error: error.message
            });
          }
        }
      }
    } catch (error) {
      console.error('Error checking scheduled broadcasts:', error);
    }
  };

  useEffect(() => {
    // Check every minute
    timerRef.current = setInterval(checkScheduledBroadcasts, 60000);

    // Initial check
    checkScheduledBroadcasts();

    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    };
  }, []);

  // This component doesn't render anything
  return null;
};

export default BroadcastScheduler; 