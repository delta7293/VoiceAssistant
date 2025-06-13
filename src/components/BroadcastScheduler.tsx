import { useEffect, useRef } from 'react';
import { makeCall } from '@/lib/makeCall';
import { db } from '@/firebase/firebaseConfig';
import { collection, updateDoc, doc, getDocs, query, where, Timestamp } from 'firebase/firestore';

interface ScheduledBroadcast {
  id: string;
  date: Timestamp;
  time: string;
  template: string;
  status: "scheduled" | "completed" | "cancelled" | "in-progress";
  clientCount: number;
  dataSetId: string;
  data?: any[];
  callSids?: string[];
  completedCalls?: number;
  failedCalls?: number;
  lastUpdated?: Timestamp;
}

export const BroadcastScheduler = () => {
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const serverUrl = 'https://dft9oxen20o6ge-3000.proxy.runpod.net';

  // Add function to check call statuses
  const checkCallStatuses = async (broadcastId: string, callSids: string[]) => {
    try {
      const broadcastRef = doc(db, 'scheduledBroadcasts', broadcastId);
      let completedCount = 0;
      let failedCount = 0;

      for (const callSid of callSids) {
        try {
          const response = await fetch(`${serverUrl}/api/call-status/${callSid}`, {
            method: 'POST',
            headers: {
              'Accept': 'application/json'
            }
          });

          if (!response.ok) continue;

          const data = await response.json();
          const status = data.data.status;
          console.log(`Call ${callSid} status:`, status);

          if (status === "completed" || status === "voicemail" || status === "answered") {
            completedCount++;
          } else if (status === "failed" || status === "no-answer" || status === "busy" || status === "canceled") {
            failedCount++;
          }
        } catch (error) {
          console.error(`Error checking status for callSid ${callSid}:`, error);
        }
      }

      // Update broadcast status in Firestore
      await updateDoc(broadcastRef, {
        completedCalls: completedCount,
        failedCalls: failedCount,
        lastUpdated: Timestamp.now()
      });

      console.log(`Updated broadcast ${broadcastId} - Completed: ${completedCount}, Failed: ${failedCount}`);

      // If all calls are completed or failed, update status to completed
      if (completedCount + failedCount === callSids.length) {
        await updateDoc(broadcastRef, {
          status: 'completed',
          lastUpdated: Timestamp.now()
        });
        console.log(`Broadcast ${broadcastId} completed`);
      }
    } catch (error) {
      console.error('Error checking call statuses:', error);
    }
  };

  // Add effect to periodically check call statuses for in-progress broadcasts
  useEffect(() => {
    const checkInProgressBroadcasts = async () => {
      try {
        const broadcastsRef = collection(db, 'scheduledBroadcasts');
        const q = query(
          broadcastsRef,
          where('status', '==', 'in-progress')
        );

        const querySnapshot = await getDocs(q);
        
        for (const doc of querySnapshot.docs) {
          const broadcast = doc.data() as ScheduledBroadcast;
          if (broadcast.callSids && broadcast.callSids.length > 0) {
            await checkCallStatuses(doc.id, broadcast.callSids);
          }
        }
      } catch (error) {
        console.error('Error checking in-progress broadcasts:', error);
      }
    };

    // Check every 30 seconds
    const interval = setInterval(checkInProgressBroadcasts, 30000);

    // Initial check
    checkInProgressBroadcasts();

    return () => clearInterval(interval);
  }, []);

  const checkScheduledBroadcasts = async () => {
    try {
      // Get current time
      const now = new Date();
      const currentTime = now.toLocaleTimeString('en-US', { 
        hour12: false, 
        hour: '2-digit', 
        minute: '2-digit' 
      });

      console.log('Current time:', currentTime);

      // Query Firestore for scheduled broadcasts with simplified query
      const broadcastsRef = collection(db, 'scheduledBroadcasts');
      const q = query(
        broadcastsRef,
        where('status', '==', 'scheduled')
      );

      try {
        const querySnapshot = await getDocs(q);

        for (const broadcastDoc of querySnapshot.docs) {
          const broadcast = broadcastDoc.data() as ScheduledBroadcast;
          const scheduledDate = broadcast.date.toDate();
          const scheduledTime = broadcast.time;
          
          console.log('Checking broadcast:', {
            id: broadcastDoc.id,
            scheduledDate: scheduledDate.toISOString(),
            scheduledTime,
            currentTime
          });

          // Check if the scheduled date is today or in the past and time matches
          if (scheduledDate <= now && scheduledTime === currentTime) {
            console.log(`Executing scheduled broadcast: ${broadcastDoc.id}`);
            
            try {
              // Update broadcast status to in-progress
              await updateDoc(doc(broadcastsRef, broadcastDoc.id), {
                status: 'in-progress',
                lastUpdated: Timestamp.now()
              });

              // Get the dataset with error handling
              try {
                const datasetRef = doc(db, 'datasets', broadcast.dataSetId);
                const datasetDoc = await getDocs(collection(datasetRef, 'data'));
                const contacts = datasetDoc.docs.map(doc => doc.data());

                // Execute calls for each contact and collect callSids
                const callSids: string[] = [];
                for (const contact of contacts) {
                  try {
                    const response = await makeCall({
                      phoneNumber: contact.phoneNumber,
                      firstName: contact.firstName,
                      lastName: contact.lastName,
                      fileNumber: contact.fileNumber,
                      template: broadcast.template
                    });
                    
                    if (response && response.callSid) {
                      callSids.push(response.callSid);
                      console.log(`CallSid: ${response.callSid}`);
                    }
                  } catch (callError) {
                    console.error(`Error making call for contact:`, callError);
                    // Continue with next contact even if one fails
                    continue;
                  }
                }

                // Update broadcast with callSids
                await updateDoc(doc(broadcastsRef, broadcastDoc.id), {
                  callSids,
                  lastUpdated: Timestamp.now()
                });

                console.log(`Broadcast ${broadcastDoc.id} started with ${callSids.length} calls`);
              } catch (datasetError) {
                console.error(`Error accessing dataset:`, datasetError);
                throw datasetError;
              }
            } catch (updateError) {
              console.error(`Error updating broadcast status:`, updateError);
              throw updateError;
            }
          }
        }
      } catch (queryError) {
        console.error('Error querying scheduled broadcasts:', queryError);
        // Don't throw here, just log the error and continue
      }
    } catch (error) {
      console.error('Error in checkScheduledBroadcasts:', error);
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