// Healthcare dApp Frontend
// Uses Web3, Truffle Contract, and jQuery for blockchain interaction

const HealthcareApp = {
    // Core app state
    web3: null,
    healthcareContract: null,
    userAccount: '0x0',
    userRoles: ['None', 'Admin', 'Patient', 'Doctor'],
  
    // Start the application
    async start() {
      await this.connectToBlockchain();
    },
  
    // Connect to blockchain and setup web3
    async connectToBlockchain() {
      // Check if MetaMask is installed
      if (!window.ethereum) {
        alert('Please install MetaMask to use this app!');
        $('#userAddress').text('MetaMask not detected');
        return;
      }
  
      try {
        // Connect to MetaMask
        this.web3 = new Web3(window.ethereum);
        const accounts = await window.ethereum.request({ 
          method: 'eth_requestAccounts' 
        });
        this.userAccount = accounts[0];
  
        // Setup MetaMask event listeners
        this.setupMetaMaskListeners();
        
        // Load the smart contract
        await this.loadContract();
      } catch (error) {
        alert('Error connecting to MetaMask: ' + error.message);
        $('#userAddress').text('Account not connected');
      }
    },
  
    // Setup MetaMask account and network change listeners
    setupMetaMaskListeners() {
      window.ethereum.on('accountsChanged', accounts => {
        this.userAccount = accounts[0];
        this.updateDisplayedUserInfo();
        this.loadUserRole();
      });
  
      window.ethereum.on('chainChanged', () => {
        window.location.reload();
      });
    },
  
    // Load the healthcare smart contract
    async loadContract() {
      try {
        const contractJson = await $.getJSON('HealthcareSystem.json');
        this.healthcareContract = TruffleContract(contractJson);
        this.healthcareContract.setProvider(this.web3.currentProvider);
  
        // Initialize app features
        await this.loadUserRole();
        await this.updateDisplayedUserInfo();
        await this.loadDoctorsList();
        await this.updateCovidStatistics();
        
        // Setup UI event handlers
        this.setupEventHandlers();
      } catch (error) {
        console.error('Failed to load contract:', error);
      }
    },
  
    // Update displayed user information
    async updateDisplayedUserInfo() {
      $('#userAddress').text(this.userAccount);
      
      try {
        const contract = await this.healthcareContract.deployed();
        const user = await contract.users(this.userAccount);
        $('#userRole').text(this.userRoles[user.role]);
      } catch (error) {
        console.error('Error showing user info:', error);
      }
    },
  
    // Load and display user role
    async loadUserRole() {
      try {
        const contract = await this.healthcareContract.deployed();
        const user = await contract.users(this.userAccount);
        const roleId = parseInt(user.role);
        if (roleId === 1) { // Admin
            $('body').addClass('admin-active');
            await this.loadPatientList();
        } else {
            $('body').removeClass('admin-active');
        }
        // Show/hide sections based on role
        $('#adminSection').toggle(roleId === 1);
        $('#patientSection').toggle(roleId === 2);
  
        if (roleId === 1) {
          await this.loadPatientList();
        }
      } catch (error) {
        console.error('Error loading role:', error);
      }
    },
  
    // Register new user
    // In your app.js
    async registerUser() {
        try {
            const contract = await this.healthcareContract.deployed();
            const name = $('#name').val();
            const roleId = parseInt($('#role').val());

            if (roleId === 2) {
                await this.registerPatient(contract);
            } else {
                if (!name) throw new Error('Name required');
                await contract.registerUser(name, roleId, { 
                    from: this.userAccount 
                });
            }

            this.showSuccess('Registration successful!');
            setTimeout(() => location.reload(), 2000);
        } catch (error) {
            this.showError('Registration failed: ' + error.message);
        }
    },
  
    // Register new patient with additional details
    async registerPatient(contract) {
      const patientInfo = {
        name: $('#name').val(),
        age: parseInt($('#age').val()),
        gender: $('#gender').val(),
        vaccineStatus: parseInt($('#vaccineStatus').val()),
        district: $('#district').val(),
        symptoms: $('#symptoms').val()
      };
  
      // Validate patient info
      if (!this.validatePatientInfo(patientInfo)) {
        throw new Error('Please fill all required fields');
      }
  
      await contract.registerPatient(
        patientInfo.name,
        patientInfo.age,
        patientInfo.gender,
        patientInfo.vaccineStatus,
        patientInfo.district,
        patientInfo.symptoms,
        { from: this.userAccount }
      );
    },
  
    // Validate patient information
    validatePatientInfo(info) {
      return info.name && 
             info.age && 
             info.gender && 
             info.district;
    },
  
    // Update patient information
    async updatePatient() {
      try {
        const contract = await this.healthcareContract.deployed();
        const patientId = $('#updatePatientId').val();
        const vaccineStatus = parseInt($('#updateVaccineStatus').val());
        const isDead = $('#isDead').is(':checked');
  
        if (!patientId) throw new Error('Patient ID required');
  
        await contract.updatePatient(
          patientId, 
          vaccineStatus, 
          isDead, 
          { from: this.userAccount }
        );
  
        this.showSuccess('Patient updated!');
        await this.loadPatientList();
        await this.updateCovidStatistics();
      } catch (error) {
        this.showError('Update failed: ' + error.message);
      }
    },
  
    // Book doctor appointment
    async bookAppointment() {
      try {
        const contract = await this.healthcareContract.deployed();
        const doctor = $('#doctorAddress').val();
        const timeSlot = parseInt($('#timeSlot').val());
  
        if (!doctor) throw new Error('Select a doctor');
  
        await contract.bookAppointment(
          doctor, 
          timeSlot, 
          { 
            from: this.userAccount,
            value: Web3.utils.toWei('1', 'ether')
          }
        );
  
        this.showSuccess('Appointment booked!');
        await this.viewDoctorSchedule(doctor);
      } catch (error) {
        this.showError('Booking failed: ' + error.message);
      }
    },
  
    // View doctor's schedule
    // Update your viewDoctorSchedule function call
    async viewDoctorSchedule(doctorAddress = null) {
        try {
            const contract = await this.healthcareContract.deployed();
            const doctor = doctorAddress || $('#scheduleDoctor').val();
            
            // Validate doctor first
            const user = await contract.users(doctor);
            if (parseInt(user.role) !== 3) throw new Error('Invalid doctor address');
            
            const schedule = await contract.viewSchedule(doctor);
            this.displaySchedule(schedule);
        } catch (error) {
            $('#scheduleDisplay').html(
                `<p class="error">Error: ${error.message}</p>`
            );
        }
    },
  
    // Display doctor's schedule
    displaySchedule(schedule) {
        const timeSlots = [
            "4:00 PM - 4:10 PM",
            "4:10 PM - 4:20 PM",
            "4:20 PM - 4:30 PM",
            "4:30 PM - 4:40 PM",
            "4:40 PM - 4:50 PM"
        ];
    
        let html = '<table border="1">';
        html += '<tr><th>Time</th><th>Patient Address</th></tr>';
        
        schedule.forEach(async (isBooked, index) => {
            const patientAddress = isBooked ? 
                (await this.healthcareContract.deployed()).doctorAppointments(
                    $('#scheduleDoctor').val(), 
                    index
                ).patient 
                : "No appointment";
                
            html += `<tr>
                <td>${timeSlots[index]}</td>
                <td>${patientAddress}</td>
            </tr>`;
        });
        
        html += '</table>';
        $('#scheduleDisplay').html(html);
    },
  
    // Update COVID statistics
    async updateCovidStatistics() {
      try {
        const contract = await this.healthcareContract.deployed();
        const stats = await this.calculateCovidStats(contract);
        this.displayCovidStats(stats);
      } catch (error) {
        console.error('Stats update error:', error);
      }
    },
  
    // Calculate COVID statistics from patient data
    async calculateCovidStats(contract) {
      const patientCount = await contract.patientCount();
      const patients = [];
  
      // Collect active patients
      for (let i = 0; i < patientCount; i++) {
        const patient = await contract.patients(i);
        if (!patient.isDead) {
          patients.push({ age: parseInt(patient.age) });
        }
      }
  
      if (patients.length === 0) {
        return { median: 0, children: 0, teenage: 0, young: 0, elder: 0 };
      }
  
      return this.processPatientStats(patients);
    },
  
    // Process patient statistics
    processPatientStats(patients) {
      const ages = patients.map(p => p.age).sort((a, b) => a - b);
      const total = ages.length;
      
      const median = total % 2 === 0 
        ? (ages[total/2 - 1] + ages[total/2]) / 2 
        : ages[Math.floor(total/2)];
  
      return {
        median,
        children: this.calculatePercentage(patients, age => age < 13),
        teenage: this.calculatePercentage(patients, age => age >= 13 && age < 20),
        young: this.calculatePercentage(patients, age => age >= 20 && age < 50),
        elder: this.calculatePercentage(patients, age => age >= 50)
      };
    },
  
    // Calculate percentage of patients in age group
    calculatePercentage(patients, ageFilter) {
      return (patients.filter(p => ageFilter(p.age)).length / patients.length) * 100;
    },
  
    // Display COVID statistics
    displayCovidStats(stats) {
      $('#medianAge').text(stats.median.toFixed(1));
      $('#childrenPercentage').text(stats.children.toFixed(1) + '%');
      $('#teenagePercentage').text(stats.teenage.toFixed(1) + '%');
      $('#youngPercentage').text(stats.young.toFixed(1) + '%');
      $('#elderPercentage').text(stats.elder.toFixed(1) + '%');
    },
  
    // Load list of doctors
    async loadDoctorsList() {
      try {
        const contract = await this.healthcareContract.deployed();
        const doctors = await contract.getAllDoctors();
        
        const select = $('#doctorAddress');
        select.empty().append('<option value="">Select a Doctor</option>');
        
        doctors.forEach(doctor => {
          select.append(`<option value="${doctor}">${doctor}</option>`);
        });
      } catch (error) {
        console.error('Error loading doctors:', error);
      }
    },
  
    // Load and display patient list
    async loadPatientList() {
      try {
        const contract = await this.healthcareContract.deployed();
        const count = await contract.getPatientCount();
        
        let table = this.createPatientTableHeader();
        
        for(let i = 0; i < count; i++) {
          const patient = await contract.patients(i);
          table += this.createPatientTableRow(i, patient);
        }
        
        table += '</tbody></table></div>';
        
        $('#adminSection').find('.patient-list').remove();
        $('#adminSection').append(table);
      } catch (error) {
        console.error('Patient list error:', error);
      }
    },
  
    // Create patient table header
    createPatientTableHeader() {
      return `
        <div class="patient-list">
          <table class="patient-table">
            <thead>
              <tr>
                <th>ID</th>
                <th>Age</th>
                <th>Gender</th>
                <th>District</th>
                <th>Vaccine Status</th>
                <th>Status</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
      `;
    },
  
    // Create patient table row
    createPatientTableRow(id, patient) {
      const vaccineStatus = ['Not Vaccinated', 'One Dose', 'Two Dose'][patient.vaccineStatus];
      const status = patient.isDead ? 'Deceased' : 'Active';
      
      return `
        <tr>
          <td>${id}</td>
          <td>${patient.age}</td>
          <td>${patient.gender}</td>
          <td>${patient.district}</td>
          <td>${vaccineStatus}</td>
          <td>${status}</td>
          <td>
            <button onclick="HealthcareApp.preparePatientUpdate(${id})" 
                    class="update-btn" 
                    ${patient.isDead ? 'disabled' : ''}>
              Update
            </button>
          </td>
        </tr>
      `;
    },
  
    // Prepare patient update form
    preparePatientUpdate(patientId) {
      $('#updatePatientId').val(patientId);
      $('html, body').animate({
        scrollTop: $('#updatePatientForm').offset().top
      }, 500);
    },
  
    // Setup UI event handlers
    setupEventHandlers() {
      $('#role').on('change', function() {
        $('#patientFields').toggle($(this).val() === '2');
      });
    },
  
    // Show success message
    showSuccess(message) {
      $('#registrationMessage')
        .removeClass('error')
        .addClass('success')
        .text(message);
    },
  
    // Show error message
    showError(message) {
      $('#registrationMessage')
        .removeClass('success')
        .addClass('error')
        .text(message);
    }
  };
  
  // Initialize app when page loads
  $(function() {
    HealthcareApp.start();
  });