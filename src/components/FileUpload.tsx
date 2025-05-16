
import React, { useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { FileUp, File, X, Check } from "lucide-react";
import { useToast } from "@/components/ui/use-toast";

interface FileUploadProps {
  onFileUploaded: (data: any[]) => void;
}

const FileUpload: React.FC<FileUploadProps> = ({ onFileUploaded }) => {
  const [isDragging, setIsDragging] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [progress, setProgress] = useState(0);
  const [isUploading, setIsUploading] = useState(false);
  const [isUploaded, setIsUploaded] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const processFile = (file: File) => {
    // Check file type
    const validTypes = [
      "application/vnd.ms-excel",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "text/csv"
    ];
    
    if (!validTypes.includes(file.type)) {
      toast({
        title: "Invalid file type",
        description: "Please upload a CSV or Excel file",
        variant: "destructive"
      });
      return;
    }

    setFile(file);
    simulateUpload(file);
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
    
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      processFile(e.dataTransfer.files[0]);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      processFile(e.target.files[0]);
    }
  };

  const simulateUpload = (file: File) => {
    setIsUploading(true);
    setProgress(0);
    
    // Simulate file processing and uploading
    const interval = setInterval(() => {
      setProgress(prev => {
        if (prev >= 100) {
          clearInterval(interval);
          setIsUploading(false);
          setIsUploaded(true);
          
          // Simulate data from the file
          const mockData = Array(10).fill(0).map((_, i) => ({
            id: i + 1,
            name: `Client ${i + 1}`,
            phone: `+1 555-${100 + i}-${1000 + i}`,
            fileNumber: `F${2000 + i}`
          }));
          
          onFileUploaded(mockData);
          
          return 100;
        }
        return prev + 10;
      });
    }, 300);
  };

  const removeFile = () => {
    setFile(null);
    setIsUploaded(false);
    setProgress(0);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  return (
    <Card className="dashboard-card">
      <div className="p-6">
        <h2 className="text-2xl font-bold mb-6 gradient-text">Upload Client Data</h2>
        
        {!file ? (
          <div
            className={`border-2 border-dashed rounded-lg p-8 text-center ${
              isDragging ? "border-broadcast-purple bg-purple-50" : "border-gray-300"
            }`}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
          >
            <FileUp className="mx-auto h-12 w-12 text-gray-400 mb-3" />
            <h3 className="text-lg font-medium mb-2">Drag & Drop your file here</h3>
            <p className="text-sm text-gray-500 mb-4">
              or click to browse files
              <br />
              <span className="text-xs">(Supported formats: .csv, .xlsx)</span>
            </p>
            <Button
              className="bg-gradient-primary hover:opacity-90"
              onClick={() => fileInputRef.current?.click()}
            >
              Select File
            </Button>
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleFileChange}
              accept=".csv, application/vnd.openxmlformats-officedocument.spreadsheetml.sheet, application/vnd.ms-excel"
              className="hidden"
            />
          </div>
        ) : (
          <div className="rounded-lg border p-4 bg-gray-50">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-3">
                <File className="h-8 w-8 text-broadcast-purple" />
                <div>
                  <p className="font-medium text-gray-700">{file.name}</p>
                  <p className="text-xs text-gray-500">
                    {(file.size / 1024).toFixed(2)} KB • {file.type}
                  </p>
                </div>
              </div>
              <Button
                variant="ghost"
                size="sm"
                className="h-8 w-8 p-0"
                onClick={removeFile}
              >
                <X className="h-5 w-5" />
              </Button>
            </div>
            
            {isUploading && (
              <>
                <Progress value={progress} className="h-2 mb-2" />
                <div className="text-xs text-gray-500 flex justify-between">
                  <span>Uploading...</span>
                  <span>{progress}%</span>
                </div>
              </>
            )}
            
            {isUploaded && (
              <div className="flex items-center gap-2 text-green-600 text-sm">
                <Check className="h-4 w-4" />
                File uploaded successfully
              </div>
            )}
          </div>
        )}
        
        <div className="mt-6">
          <h3 className="text-sm font-medium mb-2">Requirements</h3>
          <ul className="text-sm text-gray-600 space-y-1 list-disc pl-5">
            <li>File must be CSV or Excel format (.csv, .xlsx)</li>
            <li>File should contain columns: Name, Phone Number, File Number</li>
            <li>Phone numbers must include country code</li>
          </ul>
        </div>
      </div>
    </Card>
  );
};

export default FileUpload;
