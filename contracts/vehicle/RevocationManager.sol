// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;


contract RevocationManager {
    
    IVehicleRegistry public vehicleRegistry;
    
    struct RevocationReport {
        string offenderPseudonym;
        string reporterPseudonym;
        string reason;
        uint256 timestamp;
        bool processed;
    }
    
    struct RevokedVehicle {
        string pseudonym;
        uint256 revocationTime;
        string reason;
        bool isRevoked;
    }
    
    mapping(string => RevokedVehicle) public identityRevocationList;
    mapping(uint256 => RevocationReport) public reports;
    uint256 public reportCount;
    
    address public admin;
    
    event ReportSubmitted(uint256 indexed reportId, string offender, string reporter, uint256 timestamp);
    event VehicleRevoked(string pseudonym, string reason, uint256 timestamp);
    event VehicleReinstated(string pseudonym, uint256 timestamp);
    
    modifier onlyAdmin() {
        require(msg.sender == admin, "Only admin can perform this action");
        _;
    }
    
    constructor(address _vehicleRegistryAddress) {
        vehicleRegistry = IVehicleRegistry(_vehicleRegistryAddress);
        admin = msg.sender;
    }
    
    // Submit a revocation report
    function submitRevocationReport(
        string memory _offenderPseudonym,
        string memory _reporterPseudonym,
        string memory _reason
    ) external returns (uint256) {
        require(
            vehicleRegistry.isVehicleRegistered(_offenderPseudonym),
            "Offender vehicle not registered"
        );
        require(
            vehicleRegistry.isVehicleRegistered(_reporterPseudonym),
            "Reporter vehicle not registered"
        );
        require(
            !identityRevocationList[_offenderPseudonym].isRevoked,
            "Vehicle already revoked"
        );
        
        reportCount++;
        reports[reportCount] = RevocationReport({
            offenderPseudonym: _offenderPseudonym,
            reporterPseudonym: _reporterPseudonym,
            reason: _reason,
            timestamp: block.timestamp,
            processed: false
        });
        
        emit ReportSubmitted(reportCount, _offenderPseudonym, _reporterPseudonym, block.timestamp);
        
        return reportCount;
    }
    
    // Process revocation (simplified - in real system would use Oracle network)
    function processRevocation(uint256 _reportId) external onlyAdmin {
        RevocationReport storage report = reports[_reportId];
        require(!report.processed, "Report already processed");
        require(
            vehicleRegistry.isVehicleRegistered(report.offenderPseudonym),
            "Vehicle not registered"
        );
        
        // Add to Identity Revocation List
        identityRevocationList[report.offenderPseudonym] = RevokedVehicle({
            pseudonym: report.offenderPseudonym,
            revocationTime: block.timestamp,
            reason: report.reason,
            isRevoked: true
        });
        
        report.processed = true;
        
        emit VehicleRevoked(report.offenderPseudonym, report.reason, block.timestamp);
    }
    
    // Check if vehicle is revoked
    function isRevoked(string memory _pseudonym) external view returns (bool) {
        return identityRevocationList[_pseudonym].isRevoked;
    }
    
    // Get revocation details
    function getRevocationDetails(string memory _pseudonym) external view returns (
        uint256 revocationTime,
        string memory reason,
        bool isRevoked
    ) {
        RevokedVehicle memory rv = identityRevocationList[_pseudonym];
        return (rv.revocationTime, rv.reason, rv.isRevoked);
    }
    
    // Get report details
    function getReport(uint256 _reportId) external view returns (
        string memory offender,
        string memory reporter,
        string memory reason,
        uint256 timestamp,
        bool processed
    ) {
        RevocationReport memory r = reports[_reportId];
        return (r.offenderPseudonym, r.reporterPseudonym, r.reason, r.timestamp, r.processed);
    }
    
    // Reinstate a vehicle (for re-registration scenario)
    function reinstateVehicle(string memory _pseudonym) external onlyAdmin {
        require(identityRevocationList[_pseudonym].isRevoked, "Vehicle not revoked");
        
        identityRevocationList[_pseudonym].isRevoked = false;
        
        emit VehicleReinstated(_pseudonym, block.timestamp);
    }
}