import React, { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Send, Phone, CheckCircle2, AlertTriangle, Clock, Ban, Pause, FileUp } from "lucide-react";
import { useToast } from "@/components/ui/use-toast";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

interface BroadcastProps {
  clientData: any[];
  selectedTemplate: {
    id: string;
    name: string;
    content: string;
  } | null;
}

interface CallStatus {
  id: number;
  clientName: string;
  phone: string;
  status: "pending" | "in-progress" | "completed" | "failed" | "voicemail" | "no-answer" | "busy" | "canceled" | "queued" | "initiated" | "ringing" | "answered";
  message?: string;
  template?: string;
  timestamp?: string;
  direction?: string;
  metadata?: {
    contactId: string;
    campaignId: string;
    aiProfile: string;
  };
  duration?: number;
  parentCallSid?: string | null;
  lastUpdate?: {
    timestamp: string;
  };
  callSid?: string;
  pendingStartTime?: number;
}

const BroadcastControl: React.FC<BroadcastProps> = ({ 
  clientData, 
  selectedTemplate 
}) => {
  const [isBroadcasting, setIsBroadcasting] = useState(false);
  const [currentProgress, setCurrentProgress] = useState(0);
  const [callStatuses, setCallStatuses] = useState<CallStatus[]>([]);
  const [completedCalls, setCompletedCalls] = useState(0);
  const [failedCalls, setFailedCalls] = useState(0);
  const [callSids, setCallSids] = useState<string[]>([]);
  const [startTime, setStartTime] = useState<Date | null>(null);
  const [duration, setDuration] = useState<string>("00:00:00");
  const callSidsRef = useRef(callSids);
  const [retryCount, setRetryCount] = useState(0);
  const [serverUrl, setServerUrl] = useState('https://dft9oxen20o6ge-3000.proxy.runpod.net');
  // const [serverUrl, setServerUrl] = useState('https://5b79-45-205-167-251.ngrok-free.app');
  // const [serverUrl, setServerUrl] = useState('https://debd-74-80-151-196.ngrok-free.app');
  const MAX_RETRIES = 3;
  
  const { toast } = useToast();

  const pollingIntervalRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    callSidsRef.current = callSids;0
  }, [callSids]);

  // Function to check if response is an ngrok error page

  // Function to check server connection
  async function getCallStatus(callSid) {
    try {
        const response = await fetch(`${serverUrl}/api/call-status/${callSid}`, {
            method: 'POST',
            headers: {
                'Accept': 'application/json'
            }
        });

        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        const data = await response.json();
        console.log('Call Status:', JSON.stringify(data, null, 2));
        return data;
    } catch (error) {
        console.error('Error fetching call status:', error);
        throw error;
    }
}
  // Add polling function
  const pollCallStatus = async () => {
    const currentCallSids = callSidsRef.current;
    // Only log if there are active calls
    if (currentCallSids.length > 0) {
      console.log('Active calls:', currentCallSids.length);
    }
    if (!currentCallSids.length) { 
      console.log('No more calls to poll');
      pauseBroadcast();
    }
    try {
      const TEN_MINUTES = 10 * 60 * 1000;
      const currentTime = Date.now();
      
      const statusPromises = currentCallSids.map(async (callSid) => {
        try {  
          const data = await getCallStatus(callSid);

          // Update callStatuses with timestamp for pending calls
          setCallStatuses(prevStatuses =>
            prevStatuses.map(call => {
              // Remove unnecessary call logging
              if (call.callSid === callSid) {
                // If the call is pending and doesn't have a pendingStartTime, set it
                if (data.data.status === "pending" && !call.pendingStartTime) {
                  return { ...call, ...data.data, pendingStartTime: currentTime };
                }
                // If the call is no longer pending, remove the pendingStartTime
                if (data.data.status !== "pending") {
                  const { pendingStartTime, ...rest } = call;
                  return { ...rest, ...data.data };
                }
                return { ...call, ...data.data };
              }
              return call;
            })
          );

          if (data.data.status === "completed" || data.data.status === "voicemail" || data.data.status === "answered" || data.data.status === "in-progress") {
            setCallSids(prev => prev.filter(sid => sid !== callSid));
            setCompletedCalls(prev => {
              const newCompleted = prev + 1;
              setCurrentProgress(((newCompleted + failedCalls) / clientData.length) * 100);
              return newCompleted;
            });
            // Log only status changes
            console.log(`Call ${callSid} completed: ${data.data.status}`);
            toast({ title: "Call Completed", description: `Call to ${data.data.clientName} completed.` });
          } else if (data.data.status === "failed" || data.data.status === "no-answer" || data.data.status === "busy" || data.data.status === "canceled") {
            setCallSids(prev => prev.filter(sid => sid !== callSid));
            setFailedCalls(prev => {
              const newFailed = prev + 1;
              setCurrentProgress(((completedCalls + newFailed) / clientData.length) * 100);
              return newFailed;
            });
            // Log only status changes
            console.log(`Call ${callSid} failed: ${data.data.status}`);
          }

          // Remove unnecessary status logging
          if (data.data.status !== "pending" && data.data.status !== "in-progress") {
            console.log(`Call ${callSid} status updated to: ${data.data.status}`);
          }

        } catch (error) {
          console.error(`Error processing callSid ${callSid}:`, error);
          
          // If it's an ngrok error and we haven't exceeded retries
          if (error.message.includes('Ngrok connection error') && retryCount < MAX_RETRIES) {
            setRetryCount(prev => prev + 1);
            toast({
              title: "Connection Error",
              description: `Retrying connection (${retryCount + 1}/${MAX_RETRIES})...`,
              variant: "destructive"
            });
          }         
        }
      });

      await Promise.all(statusPromises);

    } catch (error) {
      console.error('Error in pollCallStatus:', error);
      toast({
        title: "Error",
        description: "Failed to poll call statuses",
        variant: "destructive"
      });
    }
  };

  const startPolling = () => {
    setRetryCount(0);
    if (pollingIntervalRef.current) {
      clearInterval(pollingIntervalRef.current);
    }
    const interval = setInterval(pollCallStatus, 5000);
    pollingIntervalRef.current = interval;
    console.log('Status polling started');
  };

  const stopPolling = () => {
    if (pollingIntervalRef.current) {
      clearInterval(pollingIntervalRef.current);
      pollingIntervalRef.current = null;
      console.log('Status polling stopped');
    }
  };

  // Remove unnecessary effect logging
  useEffect(() => {
    return () => {
      stopPolling();
    };
  }, []);

  useEffect(() => {
    console.log('Call SIDs updated:', callSids);
  }, [callSids]);

  // Helper function to personalize template
  function personalizeTemplate(template: string, client: any) {
    return template
      .replace(/\{firstName\}/g, client.firstName)
      .replace(/\{lastName\}/g, client.lastName)
      .replace(/\{fileNumber\}/g, client.fileNumber)
      .replace(/\{phoneNumber\}/g, client.phone);
  }

  function chunkArray(array, size) {
    const result = [];
    for (let i = 0; i < array.length; i += size) {
      result.push(array.slice(i, i + size));
    }
    return result;
  }

  const batchSize = 200;
  const clientChunks = chunkArray(clientData, batchSize);

  // Add duration update effect
  useEffect(() => {
    let intervalId: NodeJS.Timeout;
    
    if (isBroadcasting && startTime) {
      intervalId = setInterval(() => {
        const now = new Date();
        const diff = now.getTime() - startTime.getTime();
        
        const hours = Math.floor(diff / (1000 * 60 * 60));
        const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
        const seconds = Math.floor((diff % (1000 * 60)) / 1000);
        
        setDuration(
          `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`
        );
      }, 1000);
    }
    
    return () => {
      if (intervalId) {
        clearInterval(intervalId);
      }
    };
  }, [isBroadcasting, startTime]);

  const startBroadcast = async () => {
    if (!selectedTemplate || clientData.length === 0) {
      toast({
        title: "Error",
        description: "Please select template and client data",
        variant: "destructive"
      });
      return;
    }

    setIsBroadcasting(true);
    setCompletedCalls(0);
    setFailedCalls(0);
    setCallSids([]);
    setStartTime(new Date());  // Set start time when broadcasting begins

    try {
      // Prepare personalized messages for each client

      for (const chunk of clientChunks) {

        const response = await fetch(`${serverUrl}/api/make-call`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            phonenumber: chunk.map(client => client.phone).join(','),
            contact_id: chunk.map(client => client.id).join(','),
            contact_name: chunk.map(client => client.firstName + " " + client.lastName).join(','),
            email: chunk.map(client => client.email).join(','),
            contact_company: chunk.map(client => client.company).join(','),
            contact_position: chunk.map(client => client.position).join(','),
            empresa: "",
            voiceId: "21m00Tcm4TlvDq8ikWAM",
            stability: 90,
            similarity_boost: 20,
            style_exaggeration: 10,
            // Send personalized messages as an array
            content: chunk.map(client => personalizeTemplate(selectedTemplate.content, client)),
            todo: "",
            notodo: "",
            campaign_id: "",
            ai_profile_name: ""
          })
        });

        if (!response.ok) {
          const errorText = await response.text();
          console.error('API Error:', errorText);
          throw new Error(`Failed to start calls: ${response.status} ${response.statusText}`);
        }

        const contentType = response.headers.get('content-type');
        let data;
        
        if (contentType && contentType.includes('application/json')) {
          try {
            data = await response.json();
            
            console.log('API Response_data:', data);
            if (data.success && data.data && data.data.callSids) {
              console.log('Call SIDs:', data.data.callSids);
              setCallSids(prev => [...prev, ...data.data.callSids]);
              console.log('Call SIDs set:', callSids);
            }
          } catch (error) {
            console.error('Failed to parse JSON response:', error);
            const textResponse = await response.text();
            console.log('Raw response:', textResponse);
            data = { message: textResponse };
            console.log('API Response:', data);
          }
        } else {
          const textResponse = await response.text();
          console.log('Raw response:', textResponse);
          data = { message: textResponse };
          console.log('API Response:', data);
        }
        
        
        // Initialize call statuses
        const initialStatuses = chunk.map((client, idx) => ({
          id: client.id,
          clientName: client.firstName + " " + client.lastName,
          phone: client.phone,
          callSid: data.data.callSids[idx],
          status: "pending" as const
        }));
        
        // setCallStatuses(initialStatuses);
        setCallStatuses(prevStatuses => {
          const existingCallSids = new Set(prevStatuses.map(cs => cs.callSid));
          const newStatuses = initialStatuses.filter(cs => !existingCallSids.has(cs.callSid));
          return [...prevStatuses, ...newStatuses];
        });
        

      }

      startPolling();

    } catch (error) {
      console.error(error);
      toast({
        title: "Error",
        description: "Failed to start calls",
        variant: "destructive"
      });
      setIsBroadcasting(false);
      setStartTime(null);  // Reset start time on error
    }
  
  };

  const pauseBroadcast = () => {
    setIsBroadcasting(false);
    setStartTime(null);  // Reset start time when paused
    stopPolling();
    toast({
      title: "Broadcast paused",
      description: "You can resume broadcasting at any time"
    });
  };

  const cancelAllCalls = async () => {
    try {
      const response = await fetch(`${serverUrl}/api/cancel-all-calls`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        throw new Error('Failed to cancel calls');
      }

      const data = await response.json();
      toast({
        title: "Calls Canceled",
        description: data.message
      });

      // Reset states
      setIsBroadcasting(false);
      setCompletedCalls(0);
      setFailedCalls(0);
      setCallSids([]);
      setCallStatuses([]);
      stopPolling();
    } catch (error) {
      console.error('Error canceling calls:', error);
      toast({
        title: "Error",
        description: "Failed to cancel calls",
        variant: "destructive"
      });
    }
  };
  
  const getStatusIcon = (status: string) => {
    switch (status) {
      case "pending":
        return <Clock className="h-4 w-4 text-gray-500" />;
      case "in-progress":
      case "ringing":
      case "answered":
        return <Phone className="h-4 w-4 text-broadcast-blue animate-pulse" />;
      case "completed":
        return <CheckCircle2 className="h-4 w-4 text-broadcast-green" />;
      case "failed":
      case "no-answer":
      case "busy":
      case "canceled":
        return <AlertTriangle className="h-4 w-4 text-broadcast-red" />;
      case "voicemail":
        return <CheckCircle2 className="h-4 w-4 text-broadcast-green" />;
      case "queued":
      case "initiated":
        return <Clock className="h-4 w-4 text-gray-500" />;
      default:
        return null;
    }
  };
  
  const getStatusBadge = (status: string) => {
    switch (status) {
      case "pending":
        return <Badge variant="outline" className="text-gray-500">Pending</Badge>;
      case "ringing":
        return <Badge className="bg-broadcast-blue">In Progress</Badge>;
      case "answered":
      case "in-progress":
      case "completed":
        return <Badge className="bg-broadcast-green">Completed</Badge>;
      case "failed":
      case "no-answer":
      case "busy":
      case "canceled":
        return <Badge className="bg-broadcast-red">Failed</Badge>;
      case "voicemail":
        return <Badge className="bg-broadcast-green">Completed</Badge>;
      case "queued":
        return <Badge variant="outline" className="text-gray-500">Pending</Badge>;
      case "initiated":
        return <Badge variant="outline" className="text-gray-500">Pending</Badge>;
      default:
        return <Badge variant="outline" className="text-gray-500">Pending</Badge>;
    }
  };

  return (
    <div className="space-y-6">
      <Card className="dashboard-card">
        <div className="p-6">
          <h2 className="text-2xl font-bold mb-6 gradient-text">
            Voice Broadcast Control
          </h2>
          
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
            <div className="bg-gray-50 rounded-lg p-4 border">
              <div className="flex items-center mb-2">
                <div className="w-8 h-8 rounded-full bg-purple-100 flex items-center justify-center mr-3">
                  <FileUp className="h-4 w-4 text-broadcast-purple" />
                </div>
                <span className="font-medium">Client Data</span>
              </div>
              <span className="text-3xl font-bold text-broadcast-purple">
                {clientData.length}
              </span>
              <span className="text-sm ml-2 text-gray-500">contacts</span>
            </div>
            
            <div className="bg-gray-50 rounded-lg p-4 border">
              <div className="flex items-center mb-2">
                <div className="w-8 h-8 rounded-full bg-green-100 flex items-center justify-center mr-3">
                  <CheckCircle2 className="h-4 w-4 text-broadcast-green" />
                </div>
                <span className="font-medium">Completed</span>
              </div>
              <span className="text-3xl font-bold text-broadcast-green">
                {completedCalls}
              </span>
              <span className="text-sm ml-2 text-gray-500">calls</span>
            </div>
            
            <div className="bg-gray-50 rounded-lg p-4 border">
              <div className="flex items-center mb-2">
                <div className="w-8 h-8 rounded-full bg-red-100 flex items-center justify-center mr-3">
                  <AlertTriangle className="h-4 w-4 text-broadcast-red" />
                </div>
                <span className="font-medium">Failed</span>
              </div>
              <span className="text-3xl font-bold text-broadcast-red">
                {failedCalls}
              </span>
              <span className="text-sm ml-2 text-gray-500">calls</span>
            </div>

            <div className="bg-gray-50 rounded-lg p-4 border">
              <div className="flex items-center mb-2">
                <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center mr-3">
                  <Clock className="h-4 w-4 text-broadcast-blue" />
                </div>
                <span className="font-medium">Duration</span>
              </div>
              <span className="text-3xl font-bold text-broadcast-blue">
                {duration}
              </span>
              <span className="text-sm ml-2 text-gray-500">elapsed</span>
            </div>
          </div>
          
          <div className="mb-6">
            <div className="flex items-center justify-between mb-2">
              <h3 className="font-medium">Broadcast Progress</h3>
              <span className="text-sm text-gray-500">
                {completedCalls + failedCalls} of {clientData.length} completed
              </span>
            </div>
            <Progress value={(completedCalls + failedCalls) / clientData.length * 100} className="h-2" />
          </div>
          
          <div className="mb-6">
            <h3 className="font-medium mb-2">Selected Template</h3>
            {selectedTemplate ? (
              <div className="p-3 border rounded-lg bg-gray-50">
                <div className="font-medium text-broadcast-purple mb-1">
                  {selectedTemplate.name}
                </div>
                <p className="text-sm text-gray-600">
                  {selectedTemplate.content}
                </p>
              </div>
            ) : (
              <div className="p-3 border rounded-lg bg-gray-50 text-gray-500">
                No template selected
              </div>
            )}
          </div>
          
          <div className="flex flex-col sm:flex-row gap-3">
            {isBroadcasting ? (
              <Button
                className="bg-yellow-500 hover:bg-yellow-600 text-white gap-2"
                onClick={pauseBroadcast}
              >
                <Pause className="h-4 w-4" />
                Pause Broadcasting
              </Button>
            ) : (
              <Button
                className="bg-gradient-primary hover:opacity-90 gap-2"
                onClick={startBroadcast}
                disabled={!selectedTemplate || clientData.length === 0}
              >
                <Send className="h-4 w-4" />
                Start Broadcasting
              </Button>
            )}
            <Button
              variant="outline"
              className="gap-2"
              disabled={isBroadcasting}
              onClick={cancelAllCalls}
            >
              <Ban className="h-4 w-4" />
              Cancel
            </Button>
          </div>
        </div>
      </Card>
      
      <Card className="dashboard-card">
        <Tabs defaultValue="all">
          <div className="p-6">
            <h2 className="text-xl font-bold mb-6">Call Status</h2>
            
            <TabsList className="mb-4">
              <TabsTrigger value="all">All Calls</TabsTrigger>
              <TabsTrigger value="completed">Completed</TabsTrigger>
              <TabsTrigger value="failed">Failed</TabsTrigger>
              <TabsTrigger value="pending">Pending</TabsTrigger>
            </TabsList>
            
            <TabsContent value="all">
              <div className="border rounded-md divide-y max-h-72 overflow-y-auto">
                {callStatuses.length > 0 ? (
                  callStatuses.map((call) => (
                    <div key={call.id} className="flex items-center p-3 hover:bg-gray-50">
                      {getStatusIcon(call.status)}
                      <div className="ml-3 flex-1">
                        <div className="font-medium">{call.clientName}</div>
                        <div className="text-sm text-gray-500">{call.phone}</div>
                      </div>
                       {/* {call.status} */}
                      {getStatusBadge(call.status)}
                    </div>
                  ))
                ) : (
                  <div className="p-4 text-center text-gray-500">
                    No call data available. Start broadcasting to see call statuses.
                  </div>
                )}
              </div>
            </TabsContent>
            
            <TabsContent value="completed">
              <div className="border rounded-md divide-y max-h-72 overflow-y-auto">
                {callStatuses.filter(call => call.status === "completed" || call.status === "voicemail" || call.status === "answered" || call.status === "in-progress").length > 0 ? (
                  callStatuses
                    .filter(call => call.status === "completed" || call.status === "voicemail" || call.status === "answered" || call.status === "in-progress")
                    .map((call) => (
                      <div key={call.id} className="flex items-center p-3 hover:bg-gray-50">
                        <CheckCircle2 className="h-4 w-4 text-broadcast-green" />
                        <div className="ml-3 flex-1">
                          <div className="font-medium">{call.clientName}</div>
                          <div className="text-sm text-gray-500">{call.phone}</div>
                        </div>
                        <Badge className="bg-broadcast-green">Completed</Badge>
                      </div>
                    ))
                ) : (
                  <div className="p-4 text-center text-gray-500">
                    No completed calls yet.
                  </div>
                )}
              </div>
            </TabsContent>
            
            <TabsContent value="failed">
              <div className="border rounded-md divide-y max-h-72 overflow-y-auto">
                {callStatuses.filter(call => call.status === "failed" || call.status === "no-answer" || call.status === "busy").length > 0 ? (
                  callStatuses
                    .filter(call => call.status === "failed" || call.status === "no-answer" || call.status === "busy")
                    .map((call) => (
                      <div key={call.id} className="flex items-center p-3 hover:bg-gray-50">
                        <AlertTriangle className="h-4 w-4 text-broadcast-red" />
                        <div className="ml-3 flex-1">
                          <div className="font-medium">{call.clientName}</div>
                          <div className="text-sm text-gray-500">{call.phone}</div>
                          {call.message && (
                            <div className="text-xs text-broadcast-red">{call.message}</div>
                          )}
                        </div>
                        <Badge className="bg-broadcast-red">Failed</Badge>
                      </div>
                    ))
                ) : (
                  <div className="p-4 text-center text-gray-500">
                    No failed calls.
                  </div>
                )}
              </div>
            </TabsContent>
            
            <TabsContent value="pending">
              <div className="border rounded-md divide-y max-h-72 overflow-y-auto">
                {callStatuses.filter(call => call.status === "pending" || call.status === "ringing" || call.status === "initiated").length > 0 ? (
                  callStatuses
                    .filter(call => call.status === "pending" || call.status === "ringing" || call.status === "initiated")
                    .map((call) => (
                      <div key={call.id} className="flex items-center p-3 hover:bg-gray-50">
                        {call.status === "pending" ? 
                          <Clock className="h-4 w-4 text-gray-500" /> :
                          <Phone className="h-4 w-4 text-broadcast-blue animate-pulse" />
                        }
                        <div className="ml-3 flex-1">
                          <div className="font-medium">{call.clientName}</div>
                          <div className="text-sm text-gray-500">{call.phone}</div>
                        </div>
                        {call.status === "pending" ? 
                          <Badge variant="outline" className="text-gray-500">Pending</Badge> :
                          <Badge className="bg-broadcast-blue">In Progress</Badge>
                        }
                      </div>
                    ))
                ) : (
                  <div className="p-4 text-center text-gray-500">
                    No pending calls.
                  </div>
                )}
              </div>
            </TabsContent>
          </div>
        </Tabs>
      </Card>
    </div>
  );
};

export default BroadcastControl;
