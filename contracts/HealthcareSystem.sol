// SPDX-License-Identifier: MIT
pragma solidity >=0.7.0 <0.9.0;

contract HealthcareSystem {
    // User roles
    enum Role { None, Admin, Patient, Doctor }

    // Vaccine status
    enum VaccineStatus { NotVaccinated, OneDose, TwoDose }

    // Appointment slots
    struct AppointmentSlot {
        bool isBooked;
        address patient;
    }

    // User structure
    struct User {
        uint id;
        string name;
        Role role;
        bool isRegistered;
    }

    // Patient structure
    struct Patient {
        uint id;
        uint age;
        string gender;
        VaccineStatus vaccineStatus;
        string district;
        string symptomsDetails;
        bool isDead;
        address addedBy;
    }
    address[] public doctorsList;

    address public owner;
    uint public userCount;
    uint public patientCount;
    uint public constant bookingFee = 1 ether;
    uint[] public slots = [410, 420, 430, 440, 450]; // Slots in HHMM format

    mapping(address => User) public users;
    mapping(uint => Patient) public patients;
    mapping(address => mapping(uint => AppointmentSlot)) public doctorAppointments;

    // Events
    event UserRegistered(address indexed user, string name, Role role);
    event PatientUpdated(uint indexed patientId, VaccineStatus vaccineStatus, bool isDead);
    event AppointmentBooked(address indexed doctor, uint slot, address indexed patient);

    // Modifiers
    modifier onlyOwner() {
        require(msg.sender == owner, "Only the contract owner can perform this action.");
        _;
    }

    modifier onlyAdmin() {
        require(users[msg.sender].role == Role.Admin, "Only admin can perform this action.");
        _;
    }

    modifier onlyPatient() {
        require(users[msg.sender].role == Role.Patient, "Only patients can perform this action.");
        _;
    }

    constructor() {
        owner = msg.sender;
        userCount = 0;
        patientCount = 0;
        // Register the owner as an Admin
        users[msg.sender] = User({
            id: userCount++,
            name: "Owner",
            role: Role.Admin,
            isRegistered: true
        });
    }

    // Register a user
    function registerUser(string memory _name, Role _role) public {
        require(!users[msg.sender].isRegistered, "User is already registered.");
        require(_role != Role.None, "Invalid role.");

        users[msg.sender] = User({
            id: userCount++,
            name: _name,
            role: _role,
            isRegistered: true
        });

        // Add doctor to list if role is Doctor
        if (_role == Role.Doctor) {
            doctorsList.push(msg.sender);
        }

        emit UserRegistered(msg.sender, _name, _role);
    }
    function getAllDoctors() public view returns (address[] memory) {
        return doctorsList;
    }

    // Patients can register themselves
    function registerPatient(
        string memory _name,
        uint _age,
        string memory _gender,
        VaccineStatus _vaccineStatus,
        string memory _district,
        string memory _symptomsDetails
    ) public {
        require(!users[msg.sender].isRegistered, "User is already registered.");

        // Register as a patient
        users[msg.sender] = User({
            id: userCount++,
            name: _name,
            role: Role.Patient,
            isRegistered: true
        });

        // Add patient details
        patients[patientCount] = Patient({
            id: patientCount,
            age: _age,
            gender: _gender,
            vaccineStatus: _vaccineStatus,
            district: _district,
            symptomsDetails: _symptomsDetails,
            isDead: false,
            addedBy: msg.sender
        });

        emit UserRegistered(msg.sender, _name, Role.Patient);
        patientCount++;
    }

    // Update patient data (only admin)
    function updatePatient(uint _patientId, VaccineStatus _vaccineStatus, bool _isDead) public onlyAdmin {
        require(_patientId < patientCount, "Patient does not exist.");
        require(_vaccineStatus <= VaccineStatus.TwoDose, "Invalid vaccine status");
        Patient storage patient = patients[_patientId];
        
        require(!patient.isDead, "Cannot update a patient who is marked as deceased.");

       
        require(
            uint(_vaccineStatus) >= uint(patient.vaccineStatus),
            "Cannot revert vaccineStatus to a lower level."
        );

        patient.vaccineStatus = _vaccineStatus;

        if (_isDead) {
            patient.isDead = _isDead;
        }

        emit PatientUpdated(_patientId, _vaccineStatus, patient.isDead);
    }


    // Book a doctor's appointment
    function bookAppointment(address _doctor, uint _slot) public payable onlyPatient {
        require(users[_doctor].role == Role.Doctor, "The specified address is not a doctor.");
        require(msg.value == bookingFee, "Incorrect booking fee.");
        require(_slot < slots.length, "Invalid slot index.");
        require(!doctorAppointments[_doctor][slots[_slot]].isBooked, "Slot already booked.");

    
        doctorAppointments[_doctor][slots[_slot]] = AppointmentSlot({
            isBooked: true,
            patient: msg.sender
        });

        
        uint ownerShare = bookingFee - 1 ether;
        payable(owner).transfer(ownerShare);

        payable(_doctor).transfer(1 ether);

        emit AppointmentBooked(_doctor, slots[_slot], msg.sender);
    }


    function viewSchedule(address _doctor) public view returns (bool[] memory) {
        require(users[_doctor].role == Role.Doctor, "Not a doctor");
        bool[] memory schedule = new bool[](slots.length);
        for (uint i = 0; i < slots.length; i++) {
            schedule[i] = doctorAppointments[_doctor][slots[i]].isBooked;
        }
        return schedule;
    }

    // onvert uint to string
    function uint2str(uint _i) internal pure returns (string memory) {
        if (_i == 0) {
            return "0";
        }
        uint j = _i;
        uint len;
        while (j != 0) {
            len++;
            j /= 10;
        }
        bytes memory bstr = new bytes(len);
        uint k = len;
        while (_i != 0) {
            k = k - 1;
            uint8 temp = (48 + uint8(_i - _i / 10 * 10));
            bytes1 b1 = bytes1(temp);
            bstr[k] = b1;
            _i /= 10;
        }
        return string(bstr);
    }

    // convert address to string
    function toAsciiString(address x) internal pure returns (string memory) {
        bytes memory s = new bytes(42);
        s[0] = '0';
        s[1] = 'x';
        for (uint i = 0; i < 20; i++) {
            bytes1 b = bytes1(uint8(uint(uint160(x)) / (2**(8*(19 - i)))));
            bytes1 hi = bytes1(uint8(b) / 16);
            bytes1 lo = bytes1(uint8(b) - 16 * uint8(hi));
            s[2+i*2] = char(hi);
            s[3+i*2] = char(lo);
        }
        return string(s);
    }

    function char(bytes1 b) internal pure returns (bytes1 c) {
        if (uint8(b) < 10) return bytes1(uint8(b) + 0x30);
        else return bytes1(uint8(b) + 0x57);
    }

    //convert time slot to HH:MM format
    function timeSlotToString(uint slot) internal pure returns (string memory) {
        uint hourValue = slot / 100;
        uint minutesVal = slot % 100;
        return string(abi.encodePacked(uint2str(hourValue), ":", minutesVal < 10 ? string(abi.encodePacked("0", uint2str(minutesVal))) : uint2str(minutesVal)));
    }

    // Get patient data
    function getPatient(uint _id) public view returns (Patient memory) {
        return patients[_id];
    }
    function getPatientCount() public view returns (uint) {
    return patientCount;
}
}