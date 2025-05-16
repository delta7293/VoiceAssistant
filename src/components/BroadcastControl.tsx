
import React, { useState } from "react";
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
  status: "pending" | "in-progress" | "completed" | "failed";
  message?: string;
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
  
  const { toast } = useToast();

  const startBroadcast = () => {
    if (!selectedTemplate) {
      toast({
        title: "No template selected",
        description: "Please select a message template before broadcasting",
        variant: "destructive"
      });
      return;
    }
    
    if (clientData.length === 0) {
      toast({
        title: "No clients available",
        description: "Please upload client data before broadcasting",
        variant: "destructive"
      });
      return;
    }
    
    setIsBroadcasting(true);
    setCurrentProgress(0);
    setCompletedCalls(0);
    setFailedCalls(0);
    
    // Initialize all calls as pending
    const initialStatuses = clientData.map(client => ({
      id: client.id,
      clientName: client.name,
      phone: client.phone,
      status: "pending" as const
    }));
    
    setCallStatuses(initialStatuses);
    
    // Simulate broadcasting process
    let processedCalls = 0;
    let completedCount = 0;
    let failedCount = 0;
    
    const interval = setInterval(() => {
      if (processedCalls >= clientData.length) {
        clearInterval(interval);
        setIsBroadcasting(false);
        
        toast({
          title: "Broadcast completed",
          description: `Successfully sent to ${completedCount} clients, ${failedCount} failed`,
          variant: completedCount === clientData.length ? "default" : "destructive"
        });
        
        return;
      }
      
      setCallStatuses(prev => {
        const updated = [...prev];
        // Update current call to in-progress
        if (updated[processedCalls].status === "pending") {
          updated[processedCalls] = {
            ...updated[processedCalls],
            status: "in-progress"
          };
          return updated;
        }
        
        // Finish current call (randomly success or fail)
        const isSuccess = Math.random() > 0.2; // 80% success rate
        
        if (isSuccess) {
          updated[processedCalls] = {
            ...updated[processedCalls],
            status: "completed"
          };
          completedCount++;
          setCompletedCalls(completedCount);
        } else {
          updated[processedCalls] = {
            ...updated[processedCalls],
            status: "failed",
            message: "No answer or line busy"
          };
          failedCount++;
          setFailedCalls(failedCount);
        }
        
        processedCalls++;
        
        // Update progress
        const progressPercentage = (processedCalls / clientData.length) * 100;
        setCurrentProgress(progressPercentage);
        
        return updated;
      });
    }, 800);
  };

  const pauseBroadcast = () => {
    setIsBroadcasting(false);
    toast({
      title: "Broadcast paused",
      description: "You can resume broadcasting at any time"
    });
  };
  
  const getStatusIcon = (status: string) => {
    switch (status) {
      case "pending":
        return <Clock className="h-4 w-4 text-gray-500" />;
      case "in-progress":
        return <Phone className="h-4 w-4 text-broadcast-blue animate-pulse" />;
      case "completed":
        return <CheckCircle2 className="h-4 w-4 text-broadcast-green" />;
      case "failed":
        return <AlertTriangle className="h-4 w-4 text-broadcast-red" />;
      default:
        return null;
    }
  };
  
  const getStatusBadge = (status: string) => {
    switch (status) {
      case "pending":
        return <Badge variant="outline" className="text-gray-500">Pending</Badge>;
      case "in-progress":
        return <Badge className="bg-broadcast-blue">In Progress</Badge>;
      case "completed":
        return <Badge className="bg-broadcast-green">Completed</Badge>;
      case "failed":
        return <Badge className="bg-broadcast-red">Failed</Badge>;
      default:
        return null;
    }
  };

  return (
    <div className="space-y-6">
      <Card className="dashboard-card">
        <div className="p-6">
          <h2 className="text-2xl font-bold mb-6 gradient-text">
            Voice Broadcast Control
          </h2>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
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
          </div>
          
          <div className="mb-6">
            <div className="flex items-center justify-between mb-2">
              <h3 className="font-medium">Broadcast Progress</h3>
              <span className="text-sm text-gray-500">
                {completedCalls + failedCalls} of {clientData.length} completed
              </span>
            </div>
            <Progress value={currentProgress} className="h-2" />
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
                {callStatuses.filter(call => call.status === "completed").length > 0 ? (
                  callStatuses
                    .filter(call => call.status === "completed")
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
                {callStatuses.filter(call => call.status === "failed").length > 0 ? (
                  callStatuses
                    .filter(call => call.status === "failed")
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
                {callStatuses.filter(call => call.status === "pending" || call.status === "in-progress").length > 0 ? (
                  callStatuses
                    .filter(call => call.status === "pending" || call.status === "in-progress")
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
