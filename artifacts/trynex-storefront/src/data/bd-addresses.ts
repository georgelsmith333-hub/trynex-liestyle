export interface BDAddressData {
  divisions: Record<string, string[]>;
  upazilas: Record<string, string[]>;
}

export const BD_DIVISIONS: Record<string, string[]> = {
  "Dhaka": ["Dhaka", "Faridpur", "Gazipur", "Gopalganj", "Kishoreganj", "Madaripur", "Manikganj", "Munshiganj", "Narayanganj", "Narsingdi", "Rajbari", "Shariatpur", "Tangail"],
  "Chittagong": ["Bandarban", "Brahmanbaria", "Chandpur", "Chittagong", "Comilla", "Cox's Bazar", "Feni", "Khagrachhari", "Lakshmipur", "Noakhali", "Rangamati"],
  "Rajshahi": ["Bogra", "Chapainawabganj", "Joypurhat", "Naogaon", "Natore", "Nawabganj", "Pabna", "Rajshahi", "Sirajganj"],
  "Khulna": ["Bagerhat", "Chuadanga", "Jessore", "Jhenaidah", "Khulna", "Kushtia", "Magura", "Meherpur", "Narail", "Satkhira"],
  "Barisal": ["Barguna", "Barisal", "Bhola", "Jhalokati", "Patuakhali", "Pirojpur"],
  "Sylhet": ["Habiganj", "Moulvibazar", "Sunamganj", "Sylhet"],
  "Rangpur": ["Dinajpur", "Gaibandha", "Kurigram", "Lalmonirhat", "Nilphamari", "Panchagarh", "Rangpur", "Thakurgaon"],
  "Mymensingh": ["Jamalpur", "Mymensingh", "Netrokona", "Sherpur"],
};

export const BD_UPAZILAS: Record<string, string[]> = {
  "Dhaka": ["Adabor", "Badda", "Bangshal", "Cantonment", "Dhanmondi", "Gulshan", "Jatrabari", "Kafrul", "Keraniganj", "Khilgaon", "Lalbagh", "Mirpur", "Mohammadpur", "Motijheel", "Pallabi", "Ramna", "Sabujbagh", "Savar", "Shyampur", "Tejgaon", "Uttara", "Wari"],
  "Gazipur": ["Gazipur Sadar", "Kaliakair", "Kaliganj", "Kapasia", "Sreepur", "Tongi"],
  "Narayanganj": ["Araihazar", "Bandar", "Narayanganj Sadar", "Rupganj", "Sonargaon"],
  "Narsingdi": ["Belabo", "Monohardi", "Narsingdi Sadar", "Palash", "Raipura", "Shibpur"],
  "Tangail": ["Basail", "Bhuapur", "Delduar", "Dhanbari", "Ghatail", "Gopalpur", "Kalihati", "Madhupur", "Mirzapur", "Nagarpur", "Sakhipur", "Tangail Sadar"],
  "Kishoreganj": ["Austagram", "Bajitpur", "Bhairab", "Hossainpur", "Itna", "Karimganj", "Katiadi", "Kishoreganj Sadar", "Kuliarchar", "Mithamain", "Nikli", "Pakundia", "Tarail"],
  "Manikganj": ["Daulatpur", "Ghior", "Harirampur", "Manikganj Sadar", "Saturia", "Shivalaya", "Singair"],
  "Munshiganj": ["Gazaria", "Lohajang", "Munshiganj Sadar", "Sirajdikhan", "Sreenagar", "Tongibari"],
  "Rajbari": ["Baliakandi", "Goalandaghat", "Kalukhali", "Pangsha", "Rajbari Sadar"],
  "Madaripur": ["Kalkini", "Madaripur Sadar", "Rajoir", "Shibchar"],
  "Gopalganj": ["Gopalganj Sadar", "Kashiani", "Kotalipara", "Muksudpur", "Tungipara"],
  "Shariatpur": ["Bhedarganj", "Damudya", "Gosairhat", "Naria", "Shariatpur Sadar", "Zanjira"],
  "Faridpur": ["Alfadanga", "Bhanga", "Boalmari", "Charbhadrasan", "Faridpur Sadar", "Madhukhali", "Nagarkanda", "Sadarpur", "Saltha"],
  "Chittagong": ["Anwara", "Banshkhali", "Boalkhali", "Chandanaish", "Chittagong Sadar", "Double Mooring", "Fatikchhari", "Hathazari", "Karnaphuli", "Lohagara", "Mirsharai", "Patiya", "Rangunia", "Raozan", "Sandwip", "Satkania", "Sitakunda"],
  "Comilla": ["Barura", "Brahmanpara", "Burichang", "Chandina", "Chauddagram", "Comilla Sadar", "Daudkandi", "Debidwar", "Homna", "Laksam", "Meghna", "Monohorgonj", "Muradnagar", "Nangalkot", "Titas"],
  "Cox's Bazar": ["Chakaria", "Cox's Bazar Sadar", "Kutubdia", "Maheshkhali", "Pekua", "Ramu", "Teknaf", "Ukhia"],
  "Brahmanbaria": ["Akhaura", "Bancharampur", "Brahmanbaria Sadar", "Kasba", "Nabinagar", "Nasirnagar", "Sarail"],
  "Chandpur": ["Chandpur Sadar", "Faridganj", "Haimchar", "Haziganj", "Kachua", "Matlab Dakshin", "Matlab Uttar", "Shahrasti"],
  "Feni": ["Chhagalnaiya", "Daganbhuiyan", "Feni Sadar", "Fulgazi", "Parshuram", "Sonagazi"],
  "Lakshmipur": ["Kamalnagar", "Lakshmipur Sadar", "Raipur", "Ramganj", "Ramgati"],
  "Noakhali": ["Begumganj", "Chatkhil", "Companiganj", "Hatiya", "Kabirhat", "Noakhali Sadar", "Senbagh", "Sonaimuri", "Subarnachar"],
  "Khagrachhari": ["Dighinala", "Khagrachhari Sadar", "Lakshmichhari", "Mahalchhari", "Manikchhari", "Matiranga", "Panchhari", "Ramgarh"],
  "Rangamati": ["Baghaichhari", "Barkal", "Belaichhari", "Juraichhari", "Kaptai", "Kawkhali", "Langadu", "Naniarchar", "Rajasthali", "Rangamati Sadar"],
  "Bandarban": ["Ali Kadam", "Bandarban Sadar", "Lama", "Naikhongchhari", "Rowangchhari", "Ruma", "Thanchi"],
  "Rajshahi": ["Bagha", "Bagmara", "Boalia", "Charghat", "Durgapur", "Godagari", "Mohanpur", "Motihar", "Paba", "Puthia", "Rajpara", "Shah Makhdum", "Tanore"],
  "Bogra": ["Adamdighi", "Bogra Sadar", "Dhunat", "Dupchanchia", "Gabtali", "Kahaloo", "Nandigram", "Sariakandi", "Shajahanpur", "Sherpur", "Shibganj", "Sonatala"],
  "Chapainawabganj": ["Bholahat", "Chapainawabganj Sadar", "Gomastapur", "Nachole", "Shibganj"],
  "Naogaon": ["Atrai", "Badalgachhi", "Dhamoirhat", "Manda", "Mahadebpur", "Naogaon Sadar", "Niamatpur", "Patnitala", "Porsha", "Raninagar", "Sapahar"],
  "Natore": ["Bagatipara", "Baraigram", "Gurudaspur", "Lalpur", "Natore Sadar", "Singra"],
  "Nawabganj": ["Bholahat", "Gomastapur", "Nachole", "Nawabganj Sadar", "Shibganj"],
  "Pabna": ["Atgharia", "Bera", "Bhangura", "Chatmohar", "Faridpur", "Ishwardi", "Pabna Sadar", "Santhia", "Sujanagar"],
  "Joypurhat": ["Akkelpur", "Joypurhat Sadar", "Kalai", "Khetlal", "Panchbibi"],
  "Sirajganj": ["Belkuchi", "Chauhali", "Kamarkhand", "Kazipur", "Raiganj", "Shahjadpur", "Sirajganj Sadar", "Tarash", "Ullapara"],
  "Khulna": ["Batiaghata", "Dacope", "Dumuria", "Dighalia", "Khalishpur", "Khan Jahan Ali", "Khulna Sadar", "Koyra", "Paikgachha", "Phultala", "Rupsha", "Sonadanga", "Terokhada"],
  "Jessore": ["Abhaynagar", "Bagherpara", "Chaugachha", "Jessore Sadar", "Jhikargachha", "Keshabpur", "Manirampur", "Sharsha"],
  "Satkhira": ["Assasuni", "Debhata", "Kalaroa", "Kaliganj", "Satkhira Sadar", "Shyamnagar", "Tala"],
  "Bagerhat": ["Bagerhat Sadar", "Chitalmari", "Fakirhat", "Kachua", "Mollahat", "Mongla", "Morrelganj", "Rampal", "Sarankhola"],
  "Kushtia": ["Bheramara", "Daulatpur", "Khoksa", "Kumarkhali", "Kushtia Sadar", "Mirpur"],
  "Magura": ["Magura Sadar", "Mohammadpur", "Shalikha", "Sreepur"],
  "Meherpur": ["Gangni", "Meherpur Sadar", "Mujibnagar"],
  "Narail": ["Kalia", "Lohagara", "Narail Sadar"],
  "Chuadanga": ["Alamdanga", "Chuadanga Sadar", "Damurhuda", "Jibannagar"],
  "Jhenaidah": ["Harinakunda", "Jhenaidah Sadar", "Kaliganj", "Kotchandpur", "Maheshpur", "Shailkupa"],
  "Barisal": ["Agailjhara", "Babuganj", "Bakerganj", "Banaripara", "Barisal Sadar", "Gournadi", "Hizla", "Mehendiganj", "Muladi", "Wazirpur"],
  "Bhola": ["Bhola Sadar", "Borhanuddin", "Char Fasson", "Daulatkhan", "Lalmohan", "Manpura", "Tazumuddin"],
  "Jhalokati": ["Jhalokati Sadar", "Kathalia", "Nalchity", "Rajapur"],
  "Patuakhali": ["Bauphal", "Dashmina", "Dumki", "Galachipa", "Kalapara", "Mirzaganj", "Patuakhali Sadar", "Rangabali"],
  "Pirojpur": ["Bhandaria", "Kawkhali", "Mathbaria", "Nazirpur", "Nesarabad", "Pirojpur Sadar", "Zianagar"],
  "Barguna": ["Amtali", "Bamna", "Barguna Sadar", "Betagi", "Patharghata", "Taltali"],
  "Sylhet": ["Balaganj", "Beanibazar", "Bishwanath", "Companiganj", "Dakshin Surma", "Fenchuganj", "Golapganj", "Gowainghat", "Jaintiapur", "Kanaighat", "Osmani Nagar", "South Surma", "Sylhet Sadar", "Zakiganj"],
  "Habiganj": ["Ajmiriganj", "Bahubal", "Baniachong", "Chunarughat", "Habiganj Sadar", "Lakhai", "Madhabpur", "Nabiganj", "Shaistaganj"],
  "Moulvibazar": ["Barlekha", "Juri", "Kamalganj", "Kulaura", "Moulvibazar Sadar", "Rajnagar", "Sreemangal"],
  "Sunamganj": ["Bishwambarpur", "Chhatak", "Derai", "Dharamapasha", "Dowarabazar", "Jagannathpur", "Jamalganj", "Shalla", "South Sunamganj", "Sunamganj Sadar", "Tahirpur"],
  "Rangpur": ["Badarganj", "Gangachara", "Kaunia", "Mithapukur", "Pirgachha", "Pirganj", "Rangpur Sadar", "Taraganj"],
  "Dinajpur": ["Birampur", "Birganj", "Biral", "Bochaganj", "Chirirbandar", "Dinajpur Sadar", "Ghoraghat", "Hakimpur", "Kaharole", "Khansama", "Nawabganj", "Parbatipur", "Phulbari"],
  "Kurigram": ["Bhurungamari", "Char Rajibpur", "Chilmari", "Kurigram Sadar", "Nageshwari", "Phulbari", "Rajarhat", "Raumari", "Ulipur"],
  "Gaibandha": ["Fulchhari", "Gaibandha Sadar", "Gobindaganj", "Palashbari", "Sadullapur", "Saghata", "Sundarganj"],
  "Nilphamari": ["Dimla", "Domar", "Jaldhaka", "Kishoreganj", "Nilphamari Sadar", "Saidpur"],
  "Lalmonirhat": ["Aditmari", "Hatibandha", "Kaliganj", "Lalmonirhat Sadar", "Patgram"],
  "Thakurgaon": ["Baliadangi", "Haripur", "Pirganj", "Ranisankail", "Thakurgaon Sadar"],
  "Panchagarh": ["Atwari", "Boda", "Debiganj", "Panchagarh Sadar", "Tetulia"],
  "Mymensingh": ["Bhaluka", "Dhobaura", "Fulbaria", "Gaffargaon", "Gauripur", "Haluaghat", "Ishwarganj", "Muktagachha", "Mymensingh Sadar", "Nandail", "Phulpur", "Trishal"],
  "Jamalpur": ["Bakshiganj", "Dewanganj", "Islampur", "Jamalpur Sadar", "Madarganj", "Melandaha", "Sarishabari"],
  "Netrokona": ["Atpara", "Barhatta", "Durgapur", "Kalmakanda", "Kendua", "Khaliajuri", "Madan", "Mohanganj", "Netrokona Sadar", "Purbadhala"],
  "Sherpur": ["Jhenaigati", "Nakla", "Nalitabari", "Sherpur Sadar", "Sreebardi"],
};

export const BD_POST_CODES: Record<string, string> = {
  "Dhaka": "1000", "Gazipur": "1700", "Narayanganj": "1400", "Narsingdi": "1600",
  "Tangail": "1900", "Kishoreganj": "2300", "Manikganj": "1800", "Munshiganj": "1500",
  "Rajbari": "7700", "Madaripur": "8500", "Gopalganj": "8100", "Shariatpur": "8000",
  "Faridpur": "1800", "Chittagong": "4000", "Comilla": "3500", "Cox's Bazar": "4700",
  "Brahmanbaria": "3400", "Chandpur": "3600", "Feni": "3900", "Lakshmipur": "3700",
  "Noakhali": "3800", "Khagrachhari": "4400", "Rangamati": "4500", "Bandarban": "4600",
  "Rajshahi": "6000", "Bogra": "5800", "Chapainawabganj": "6300", "Naogaon": "6500",
  "Natore": "6400", "Nawabganj": "6000", "Pabna": "6600", "Joypurhat": "5900",
  "Sirajganj": "6700", "Khulna": "9100", "Jessore": "7400", "Satkhira": "9400",
  "Bagerhat": "9300", "Kushtia": "7000", "Magura": "7600", "Meherpur": "7100",
  "Narail": "7500", "Chuadanga": "8700", "Jhenaidah": "7300", "Barisal": "8200",
  "Bhola": "8300", "Jhalokati": "8400", "Patuakhali": "8600", "Pirojpur": "8500",
  "Barguna": "8700", "Sylhet": "3100", "Habiganj": "3300", "Moulvibazar": "3200",
  "Sunamganj": "3000", "Rangpur": "5400", "Dinajpur": "5200", "Kurigram": "5600",
  "Gaibandha": "5700", "Nilphamari": "5500", "Lalmonirhat": "5500", "Thakurgaon": "5100",
  "Panchagarh": "5100", "Mymensingh": "2200", "Jamalpur": "2000", "Netrokona": "2400",
  "Sherpur": "2100",
};

export const BD_UPAZILA_POST_CODES: Record<string, Record<string, string>> = {
  "Dhaka": {
    "Savar": "1340", "Uttara": "1230", "Mirpur": "1216", "Dhanmondi": "1205",
    "Gulshan": "1212", "Motijheel": "1000", "Mohammadpur": "1207", "Tejgaon": "1215",
    "Keraniganj": "1310", "Pallabi": "1216", "Kafrul": "1206", "Ramna": "1000",
    "Lalbagh": "1211", "Wari": "1203", "Jatrabari": "1204", "Khilgaon": "1219",
    "Badda": "1212", "Shyampur": "1204", "Sabujbagh": "1214", "Adabor": "1207",
    "Cantonment": "1206", "Bangshal": "1100",
  },
  "Gazipur": {
    "Tongi": "1710", "Gazipur Sadar": "1700", "Sreepur": "1740",
    "Kaliakair": "1750", "Kaliganj": "1720", "Kapasia": "1730",
  },
  "Narayanganj": {
    "Narayanganj Sadar": "1400", "Rupganj": "1460", "Sonargaon": "1440",
    "Araihazar": "1450", "Bandar": "1410",
  },
  "Tangail": { "Tangail Sadar": "1900", "Madhupur": "1996", "Mirzapur": "1990" },
  "Chittagong": { "Chittagong Sadar": "4000", "Hathazari": "4330", "Sitakunda": "4310" },
  "Comilla": { "Comilla Sadar": "3500", "Daudkandi": "3516", "Laksam": "3570" },
  "Cox's Bazar": { "Cox's Bazar Sadar": "4700", "Teknaf": "4760", "Ukhia": "4750" },
  "Sylhet": { "Sylhet Sadar": "3100" },
  "Rajshahi": { "Rajshahi Sadar": "6000" },
  "Bogra": { "Bogra Sadar": "5800" },
  "Khulna": { "Khulna Sadar": "9100" },
  "Barisal": { "Barisal Sadar": "8200" },
  "Rangpur": { "Rangpur Sadar": "5400" },
  "Mymensingh": { "Mymensingh Sadar": "2200" },
  "Jessore": { "Jessore Sadar": "7400" },
  "Dinajpur": { "Dinajpur Sadar": "5200" },
  "Pabna": { "Ishwardi": "6620", "Pabna Sadar": "6600" },
  "Sirajganj": { "Sirajganj Sadar": "6700" },
  "Nilphamari": { "Saidpur": "5310", "Nilphamari Sadar": "5500" },
  "Habiganj": { "Habiganj Sadar": "3300" },
  "Moulvibazar": { "Sreemangal": "3210", "Moulvibazar Sadar": "3200" },
  "Jamalpur": { "Jamalpur Sadar": "2000" },
  "Sherpur": { "Sherpur Sadar": "2100" },
  "Kushtia": { "Kushtia Sadar": "7000", "Mirpur": "7030" },
  "Magura": { "Magura Sadar": "7600", "Mohammadpur": "7650", "Sreepur": "7660" },
};

export function getDivisionForDistrict(district: string): string | undefined {
  for (const [division, districts] of Object.entries(BD_DIVISIONS)) {
    if (districts.includes(district)) return division;
  }
  return undefined;
}

export function getAllDistricts(): string[] {
  return Object.values(BD_DIVISIONS).flat().sort();
}

export function getPostCode(district: string, upazila?: string): string {
  if (upazila && BD_UPAZILA_POST_CODES[district]?.[upazila]) {
    return BD_UPAZILA_POST_CODES[district][upazila];
  }
  return BD_POST_CODES[district] || "";
}

export function getUpazilasForDistrict(district: string): string[] {
  return BD_UPAZILAS[district] || [];
}
