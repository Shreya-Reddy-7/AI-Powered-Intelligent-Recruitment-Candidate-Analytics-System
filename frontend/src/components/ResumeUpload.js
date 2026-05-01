import React, { useRef, useState } from 'react';

const ResumeUpload = ({ onUpload, compact = false }) => {
  const [uploading, setUploading] = useState(false);
  const [selectedName, setSelectedName] = useState('');
  const inputRef = useRef(null);

  const handleFileSelect = async (event) => {
    const selectedFile = event.target.files?.[0];
    if (!selectedFile) {
      return;
    }

    setUploading(true);
    setSelectedName(selectedFile.name);

    try {
      await onUpload(selectedFile);
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className={`glass-panel ${compact ? 'p-5' : 'p-6 md:p-8'}`}>
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <p className="badge border-emerald-300/20 bg-emerald-300/10 text-emerald-100">Resume Intake</p>
          <h3 className="mt-3 text-xl font-semibold text-white">Upload a PDF or DOCX resume</h3>
          <p className="mt-2 max-w-xl text-sm leading-6 text-slate-300">
            The backend will parse skills, education, experience, and generate AI guidance for ranking.
          </p>
          {selectedName && <p className="mt-3 text-sm text-cyan-200">Selected: {selectedName}</p>}
        </div>
        <div className="flex flex-wrap gap-3">
          <button
            type="button"
            className="primary-button"
            onClick={() => inputRef.current?.click()}
            disabled={uploading}
          >
            {uploading ? 'Uploading...' : 'Choose resume'}
          </button>
        </div>
      </div>
      <input
        ref={inputRef}
        type="file"
        accept=".pdf,.doc,.docx"
        onChange={handleFileSelect}
        disabled={uploading}
        className="hidden"
      />
    </div>
  );
};

export default ResumeUpload;
