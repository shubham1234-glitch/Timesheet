"use client";

import React from 'react';
import { Epic } from "@/app/types/EpicTypes";

interface EpicClientDetailsProps {
  epicData: Epic;
  isReadOnly?: boolean;
}

const EpicClientDetails: React.FC<EpicClientDetailsProps> = ({
  epicData,
  isReadOnly = false,
}) => {
  // Extract client and contact person from epic data
  // Try multiple possible field names from API response
  const clientName = (epicData as any)?.clientName 
    || (epicData as any)?.companyName 
    || (epicData as any)?.epic_company_name
    || '';
  const clientCode = (epicData as any)?.clientCode 
    || (epicData as any)?.companyCode 
    || (epicData as any)?.epic_company_code
    || '';
  const contactPersonName = (epicData as any)?.contactPersonName 
    || (epicData as any)?.epic_contact_person_name
    || '';
  const contactPersonCode = (epicData as any)?.contactPersonCode 
    || (epicData as any)?.epic_contact_person_code
    || '';

  // Display name if available, otherwise fallback to code
  const displayCompany = clientName || clientCode || '-';
  const displayContactPerson = contactPersonName || contactPersonCode || '-';

  return (
    <div className="bg-white shadow-lg rounded-xl p-3 sm:p-4 space-y-4">
      <h3 className="text-[10px] font-semibold text-gray-800 mb-3">Client Details</h3>
      
      {/* Company/Client */}
      <div>
        <label className="block text-[9px] font-semibold text-gray-900 mb-1.5">Company</label>
        <div className="text-[9px] text-gray-600 font-normal">
          {displayCompany}
        </div>
      </div>

      {/* Contact Person */}
      <div>
        <label className="block text-[9px] font-semibold text-gray-900 mb-1.5">Contact Person</label>
        <div className="text-[9px] text-gray-600 font-normal">
          {displayContactPerson}
        </div>
      </div>
    </div>
  );
};

export default EpicClientDetails;

