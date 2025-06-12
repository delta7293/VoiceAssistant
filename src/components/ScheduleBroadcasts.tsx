import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Calendar } from "@/components/ui/calendar";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useToast } from "@/components/ui/use-toast";
import { CalendarClock, Plus, Trash2, X, Upload, FileSpreadsheet } from "lucide-react";
import { format } from "date-fns";
import * as XLSX from 'xlsx';
import TemplateManager from "./TemplateManager";
import { db } from "@/lib/firebase";
import { collection, addDoc, updateDoc, doc, Timestamp } from "firebase/firestore";
import BroadcastScheduler from "./BroadcastScheduler";

interface DataSet {
  id: string;
  name: string;
  data: any[];
  fileName: string;
  uploadDate: Date;
}

interface ScheduledBroadcast {
  id: string;
  date: Date;
  time: string;
  template: string;
  status: "scheduled" | "completed" | "cancelled";
  clientCount: number;
  dataSetId: string;
}

interface BroadcastScheduleItem {
  id: string;
  date: Date | undefined;
  time: string;
  selectedDataSetId: string | null;
  selectedTemplate: Template | null;
}

interface Template {
  id: string;
  name: string;
  content: string;
  createdAt: Date;
  isDefault?: boolean;
}

const ScheduleBroadcasts: React.FC = () => {
  const [dataSets, setDataSets] = useState<DataSet[]>([]);
  const [scheduleItems, setScheduleItems] = useState<BroadcastScheduleItem[]>([{
    id: '1',
    date: new Date(),
    time: "09:00",
    selectedDataSetId: null,
    selectedTemplate: null
  }]);
  const [scheduledBroadcasts, setScheduledBroadcasts] = useState<ScheduledBroadcast[]>([]);
  const { toast } = useToast();

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    try {
      const reader = new FileReader();
      reader.onload = (e) => {
        const data = new Uint8Array(e.target?.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: 'array' });
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        const jsonData = XLSX.utils.sheet_to_json(worksheet);

        const newDataSet: DataSet = {
          id: Date.now().toString(),
          name: file.name.split('.')[0],
          data: jsonData,
          fileName: file.name,
          uploadDate: new Date()
        };

        setDataSets(prev => [...prev, newDataSet]);
        toast({
          title: "Dataset Uploaded",
          description: `Successfully uploaded ${file.name} with ${jsonData.length} records`
        });
      };
      reader.readAsArrayBuffer(file);
    } catch (error) {
      console.error('Error uploading file:', error);
      toast({
        title: "Upload Error",
        description: "Failed to upload file",
        variant: "destructive"
      });
    }
  };

  // Generate time slots for the select component
  const generateTimeSlots = () => {
    const slots = [];
    for (let hour = 9; hour <= 17; hour++) {
      for (let minute = 0; minute < 60; minute += 30) {
        const timeString = `${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`;
        slots.push(timeString);
      }
    }
    return slots;
  };

  const handleAddScheduleItem = () => {
    setScheduleItems(prev => [...prev, {
      id: Date.now().toString(),
      date: new Date(),
      time: "09:00",
      selectedDataSetId: null,
      selectedTemplate: null
    }]);
  };

  const handleRemoveScheduleItem = (id: string) => {
    setScheduleItems(prev => prev.filter(item => item.id !== id));
  };

  const handleUpdateScheduleItem = (id: string, updates: Partial<BroadcastScheduleItem>) => {
    setScheduleItems(prev => prev.map(item => 
      item.id === id ? { ...item, ...updates } : item
    ));
  };

  const handleScheduleBroadcast = async () => {
    const invalidItems = scheduleItems.filter(item => 
      !item.date || !item.time || !item.selectedTemplate || !item.selectedDataSetId
    );

    if (invalidItems.length > 0) {
      toast({
        title: "Error",
        description: "Please fill in all required fields for each schedule",
        variant: "destructive"
      });
      return;
    }

    try {
      const broadcastsRef = collection(db, 'scheduledBroadcasts');
      
      // Save each schedule to Firebase
      for (const item of scheduleItems) {
        const dataSet = dataSets.find(d => d.id === item.selectedDataSetId);
        
        await addDoc(broadcastsRef, {
          date: Timestamp.fromDate(item.date!),
          time: item.time,
          template: item.selectedTemplate?.content,
          status: "scheduled",
          clientCount: dataSet?.data.length || 0,
          dataSetId: item.selectedDataSetId,
          createdAt: Timestamp.now()
        });
      }

      setScheduledBroadcasts(prev => [
        ...prev,
        ...scheduleItems.map(item => {
          const dataSet = dataSets.find(d => d.id === item.selectedDataSetId);
          return {
            id: Date.now().toString(),
            date: item.date!,
            time: item.time,
            template: item.selectedTemplate?.name || "Unknown",
            status: "scheduled" as const,
            clientCount: dataSet?.data.length || 0,
            dataSetId: item.selectedDataSetId!
          };
        })
      ]);
      
      toast({
        title: "Broadcasts Scheduled",
        description: `Successfully scheduled ${scheduleItems.length} broadcasts`
      });

      // Reset form
      setScheduleItems([{
        id: Date.now().toString(),
        date: new Date(),
        time: "09:00",
        selectedDataSetId: null,
        selectedTemplate: null
      }]);
    } catch (error) {
      console.error('Error scheduling broadcasts:', error);
      toast({
        title: "Error",
        description: "Failed to schedule broadcasts. Please try again.",
        variant: "destructive"
      });
    }
  };

  const handleCancelSchedule = async (id: string) => {
    try {
      const broadcastRef = doc(db, 'scheduledBroadcasts', id);
      await updateDoc(broadcastRef, {
        status: "cancelled",
        cancelledAt: Timestamp.now()
      });

      setScheduledBroadcasts(prev =>
        prev.map(schedule =>
          schedule.id === id ? { ...schedule, status: "cancelled" } : schedule
        )
      );

      toast({
        title: "Schedule Cancelled",
        description: "The scheduled broadcast has been cancelled"
      });
    } catch (error) {
      console.error('Error cancelling broadcast:', error);
      toast({
        title: "Error",
        description: "Failed to cancel broadcast. Please try again.",
        variant: "destructive"
      });
    }
  };

  return (
    <>
      <BroadcastScheduler />
      <Card className="dashboard-card">
        <div className="p-6">
          <h2 className="text-2xl font-bold mb-6 gradient-text">
            Schedule Multiple Broadcasts
          </h2>

          {/* Dataset Upload Section */}
          <div className="mb-8">
            <h3 className="font-medium mb-4">Upload Client Datasets</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="border rounded-lg p-4">
                <input
                  type="file"
                  accept=".xlsx,.xls,.csv"
                  onChange={handleFileUpload}
                  className="hidden"
                  id="file-upload"
                />
                <label
                  htmlFor="file-upload"
                  className="flex flex-col items-center justify-center p-6 border-2 border-dashed rounded-lg cursor-pointer hover:bg-gray-50"
                >
                  <Upload className="w-8 h-8 text-gray-400 mb-2" />
                  <span className="text-sm text-gray-500">Click to upload dataset</span>
                  <span className="text-xs text-gray-400 mt-1">Excel or CSV files</span>
                </label>
              </div>

              <div className="border rounded-lg p-4">
                <h4 className="font-medium mb-2">Uploaded Datasets</h4>
                <div className="space-y-2 max-h-40 overflow-y-auto">
                  {dataSets.map(dataset => (
                    <div key={dataset.id} className="flex items-center justify-between p-2 bg-gray-50 rounded">
                      <div className="flex items-center">
                        <FileSpreadsheet className="w-4 h-4 text-gray-500 mr-2" />
                        <div>
                          <p className="text-sm font-medium">{dataset.name}</p>
                          <p className="text-xs text-gray-500">{dataset.data.length} records</p>
                        </div>
                      </div>
                      <span className="text-xs text-gray-500">
                        {format(dataset.uploadDate, 'PP')}
                      </span>
                    </div>
                  ))}
                  {dataSets.length === 0 && (
                    <p className="text-sm text-gray-500 text-center py-4">
                      No datasets uploaded yet
                    </p>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Schedule Items */}
          <div className="space-y-6 mb-6">
            {scheduleItems.map((item, index) => (
              <div key={item.id} className="border rounded-lg p-4 relative">
                {scheduleItems.length > 1 && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="absolute top-2 right-2"
                    onClick={() => handleRemoveScheduleItem(item.id)}
                  >
                    <X className="w-4 h-4 text-gray-500" />
                  </Button>
                )}
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <h3 className="font-medium mb-3">Schedule {index + 1}</h3>
                    <div className="space-y-4">
                      <Calendar
                        mode="single"
                        selected={item.date}
                        onSelect={(date) => handleUpdateScheduleItem(item.id, { date })}
                        className="rounded-md border"
                        disabled={(date) => date < new Date()}
                      />
                      <Select
                        value={item.time}
                        onValueChange={(time) => handleUpdateScheduleItem(item.id, { time })}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select time" />
                        </SelectTrigger>
                        <SelectContent>
                          {generateTimeSlots().map((time) => (
                            <SelectItem key={time} value={time}>
                              {time}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <div className="space-y-4">
                    <div>
                      <h4 className="font-medium mb-2">Select Dataset</h4>
                      <Select
                        value={item.selectedDataSetId || ""}
                        onValueChange={(dataSetId) => handleUpdateScheduleItem(item.id, { selectedDataSetId: dataSetId })}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Choose a dataset" />
                        </SelectTrigger>
                        <SelectContent>
                          {dataSets.map((dataset) => (
                            <SelectItem key={dataset.id} value={dataset.id}>
                              {dataset.name} ({dataset.data.length} contacts)
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div>
                      <h4 className="font-medium mb-2">Select Template</h4>
                      <TemplateManager
                        selectedTemplate={item.selectedTemplate}
                        onTemplateSelected={(template) => handleUpdateScheduleItem(item.id, { selectedTemplate: template })}
                      />
                    </div>

                    <div className="bg-gray-50 p-3 rounded-md">
                      <h4 className="text-sm font-medium mb-2">Selected Details:</h4>
                      <div className="text-sm text-gray-600">
                        <p>Date: {item.date ? format(item.date, 'PPP') : 'Not selected'}</p>
                        <p>Time: {item.time}</p>
                        <p>Dataset: {dataSets.find(d => d.id === item.selectedDataSetId)?.name || 'Not selected'}</p>
                        <p>Template: {item.selectedTemplate?.name || 'Not selected'}</p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            ))}

            <Button
              variant="outline"
              onClick={handleAddScheduleItem}
              className="w-full"
            >
              <Plus className="w-4 h-4 mr-2" />
              Add Another Schedule
            </Button>
          </div>

          <div className="flex gap-4 mb-6">
            <Button
              className="flex-1 md:flex-none"
              onClick={handleScheduleBroadcast}
              disabled={scheduleItems.length === 0 || dataSets.length === 0}
            >
              <CalendarClock className="w-4 h-4 mr-2" />
              Schedule All Broadcasts
            </Button>
          </div>

          {/* Scheduled Broadcasts Table */}
          <div>
            <h3 className="font-medium mb-3">Scheduled Broadcasts</h3>
            <div className="border rounded-md">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date & Time</TableHead>
                    <TableHead>Dataset</TableHead>
                    <TableHead>Template</TableHead>
                    <TableHead>Contacts</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Action</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {scheduledBroadcasts.length > 0 ? (
                    scheduledBroadcasts.map((schedule) => (
                      <TableRow key={schedule.id}>
                        <TableCell>
                          {format(schedule.date, 'PPP')} at {schedule.time}
                        </TableCell>
                        <TableCell>
                          {dataSets.find(d => d.id === schedule.dataSetId)?.name}
                        </TableCell>
                        <TableCell>{schedule.template}</TableCell>
                        <TableCell>{schedule.clientCount} contacts</TableCell>
                        <TableCell>
                          <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                            schedule.status === "scheduled" ? "bg-blue-100 text-blue-800" :
                            schedule.status === "completed" ? "bg-green-100 text-green-800" :
                            "bg-red-100 text-red-800"
                          }`}>
                            {schedule.status.charAt(0).toUpperCase() + schedule.status.slice(1)}
                          </span>
                        </TableCell>
                        <TableCell className="text-right">
                          {schedule.status === "scheduled" && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleCancelSchedule(schedule.id)}
                            >
                              <Trash2 className="w-4 h-4 text-red-500" />
                            </Button>
                          )}
                        </TableCell>
                      </TableRow>
                    ))
                  ) : (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center text-gray-500 py-4">
                        No scheduled broadcasts
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          </div>
        </div>
      </Card>
    </>
  );
};

export default ScheduleBroadcasts;
