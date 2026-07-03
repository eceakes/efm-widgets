(function(){
  "use strict";

  /* ============================================================================
     EFM 2026 FELLOWS + CONDUCTING SCHOLARS  —  tabbed bio/headshot directory
     ----------------------------------------------------------------------------
     Same look + engine as the public Faculty page (efm-faculty.js), but for the
     Fellows page. Two tabs: "2026 Fellows" (the Orchestral Fellows) and "2026
     Conducting Scholars", split by the sheet's Section column.

     DATA (blob-first, three layers, so the page never blanks):
       1. The faculty DISTILLED BLOB (one gviz request on docs.google.com, decoded
          from base64 -> JSON). It already carries the whole Fellows sheet under
          workbooks.fellows.Fellows and rebuilds ~1 min after any sheet edit, so
          this is the fast path AND survives campus wifi that blocks jsDelivr.
       2. If the blob is unreachable/incomplete: the Fellows Google Sheet read
          directly (gviz CSV primary + publish-to-web CSV backup), same as the
          older efm-fellows.html widget.
       3. If every network source fails: the built-in FALLBACK_DATA roster below.
     Editing the Fellows sheet is a CONTENT change: it appears live, no redeploy.
     ============================================================================ */

  /* ====================== CONFIG ====================== */

  /* --- Layer 1: the faculty distilled blob (fast path) --------------------- */
  /* One base64 blob published by the faculty distiller (efm-facultyportal-
     distiller.gs) in its own Google Sheet; workbooks.fellows.Fellows holds the
     full Fellows roster. Set BLOB_ENABLED = false to force the direct-sheet path. */
  var FACULTY_BLOB_ID = "1ZDXeVsSVIQYEC4FtzVs8jcUjalhkZHrQAYGjTKbTJGo";
  var BLOB_TAB = "blob";
  var BLOB_WORKBOOK = "fellows";
  var BLOB_SHEET = "Fellows";
  var BLOB_ENABLED = true;

  /* --- Layer 2: the Fellows sheet, read directly (blob fallback) ----------- */
  /* The same sheet the older efm-fellows.html reads. Primary = gviz CSV (CORS-
     clean from the live site); publish-to-web CSV is the automatic backup. */
  var SHEET_CSV_URL = "https://docs.google.com/spreadsheets/d/13-BoGp6mgwtO4Dik00yL8GtBCNJxGF5R6dWfS3LnF6Q/gviz/tq?tqx=out:csv&gid=0";
  var SHEET_CSV_FALLBACKS = ["https://docs.google.com/spreadsheets/d/e/2PACX-1vQwqLaKpbTcG97P3JqEynwskulE7oxMaRAb2KfBKZjPtRu7P53IiZ2tUwtnu7rVPcVHcyaemFUduaqV/pub?gid=0&single=true&output=csv"];

  /* Heading shown above the tabs. Set to "" to hide it (the Duda page usually
     supplies its own page title, so this defaults to hidden). */
  var MODULE_TITLE = "";

  /* Tabs. Each tab shows one slice of the roster, split by Section. The
     "conducting" tab gets every row whose Section mentions "conduct"; the
     "fellows" tab gets everything else, so a renamed/added fellow section never
     drops anyone. First tab is the load default. */
  var TABS = [
    { key: "fellows",    label: "2026 Fellows" },
    { key: "conducting", label: "2026 Conducting Scholars" }
  ];
  var DEFAULT_TAB = "fellows";

  /* Message shown in a tab that currently has nobody. */
  var EMPTY_MSG = {
    fellows:    "Fellows will be announced soon.",
    conducting: "Conducting scholars will be announced soon."
  };

  /* Which tab a person belongs in: conducting if the Section says so. */
  function isConducting(section){ return /conduct/i.test(String(section || "")); }

  /* Built-in roster (safety net for a total network outage). Columns mirror the
     sheet: name, role, section, photo, link, bio, affiliations, website.
     GENERATED from the live blob; the sheet stays the source of truth. */
  var FALLBACK_DATA = [
    {name:"Kai-Chun Wong",role:"Conducting Scholar",section:"Conducting Scholars",photo:"https://irp.cdn-website.com/1e6f3c7e/dms3rep/multi/Kai-Chun+Wong+Headshot.jpg",link:"",bio:"An emerging conductor and violinist/violist, Kai-Chun Wong served as Conducting Assistant of the Rapides (LA) Symphony Orchestra during the 2024–25 season. A prize-winning conductor, Wong received First Prize at the 2025 Los Angeles Conducting Workshop and Competition and Second Prize at the 36th International Conductors Workshop and Competition in Atlanta.\n\nAs an orchestral musician, Wong has performed across the southern United States. He served as principal second violin of the Longview (TX) Symphony, and currently collaborates regularly as a violinist with the Louisiana Philharmonic and as a violist with the Acadiana (LA) Symphony. A two-time participant in the Youth Music Culture Guangdong (CN), he performed under the baton of Michael Stern alongside Yo-Yo Ma, experiences that deepened his belief in music’s ability to connect communities and create meaningful impact.\n\nA native of Hong Kong, Wong holds a B.A. in Music from Hong Kong Baptist University and a M.M. in Orchestral Conducting from Louisiana State University, where he studied with Scott Terrell.\n\nHe will pursue the Professional Studies Diploma in Conducting at the Mannes School of Music beginning this fall.\n\nOutside of music, Kai-Chun enjoys cooking and rock climbing, with an outdoor record of 5.11a in Hong Kong.",affiliations:"",website:""},
    {name:"Yifei (Joey) Sun",role:"Conducting Scholar",section:"Conducting Scholars",photo:"https://irp.cdn-website.com/1e6f3c7e/dms3rep/multi/Yifei-Joey-Sun.jpg",link:"",bio:"Chinese-born conductor Yifei (Joey) Sun is an emerging orchestral conductor currently pursuing a Doctor of Musical Arts in Orchestral Conducting at the University of Iowa, where she studies with Dr. Kenny Lee and also serves as a teaching assistant. Her studies include a secondary area in Composition under Dr. Jean-François Charles. Previously, she earned a Master of Music in Orchestral Conducting from the University of Minnesota Duluth, where she held a teaching assistant position leading numerous performances, including collaborations with the Opera Studio and the University Orchestra. Her conducting journey began with a Bachelor of Music from the Xinghai Conservatory of Music in Guangzhou, China.\n\nYifei is the winner of the 35th International Conductors Workshop and Competition in Atlanta in 2025, where she worked with conductors Adrian Gnam and Phillip Greenberg. In the 2023 International Competition of Asian Instrumental and Choral Conductors for Ancient Strings and New Rhymes, she received second place in the Instrumental Conductor category.\n\nYifei has continued to develop her artistry through masterclasses and mentorship. She has studied under esteemed conductors including Professor Tongyi Cao, Professor Wei Gao, and Professor Rudy Perrault, whose guidance has played an important role in shaping her musical and artistic development.",affiliations:"",website:""},
    {name:"Paxson Amy",role:"Conducting Scholar",section:"Conducting Scholars",photo:"https://irp.cdn-website.com/1e6f3c7e/dms3rep/multi/Paxton-Amy-Headshot.jpg",link:"",bio:"Paxson Amy’s love for orchestral music stems from a commitment to community-building. In 2026, he begins his tenure as conductor of the Greater Twin Cities Youth Symphonies (GTCYS) Philharmonic and as a Teaching Assistant in orchestral conducting at the University of Minnesota, where he will study with Mark Russell Smith. Previously, Paxson served as conductor of the Vanderbilt Commodore Orchestra in Nashville, Tennessee, a community-run orchestra where he developed his passion for ensemble empowerment, for leadership which inspires each musician to take ownership of the orchestra’s artistic product. Other conducting engagements at Vanderbilt included the Vanderbilt University Orchestra, Wind Symphony, Opera Theatre, and Ballet Theatre. At Vanderbilt University's Blair School of Music, Paxson studied conducting with Dr. Ernesto Estigarribia Mussi and horn with Professor Leslie Norton. Paxson graduated cum laude with a Bachelor's in Music, Concentration in Musicology for which he wrote a thesis entitled Orchestral Musings, a compilation of case studies in early 20th-century orchestral performance practice.\n\nPaxson’s eyes were opened to the artistic heights a group of young musicians can reach when he participated as a horn player in Carnegie Hall’s National Youth Orchestra program at age 17. He has since traveled internationally as an orchestral musician, performing in Czechia and Paraguay, and was a recipient of Vanderbilt University’s Martin Williams Award for most outstanding undergraduate paper as well as the Richard C. Cooper Award, a recognition of leadership and impact in the greater Vanderbilt community. Other conducting mentors include Kevin Noe and Thomas Verrier.",affiliations:"",website:""},
    {name:"Elias Gilbert",role:"Conducting Scholar",section:"Conducting Scholars",photo:"https://irp.cdn-website.com/1e6f3c7e/dms3rep/multi/eligilbert_baton_headshot_square.jpg",link:"",bio:"Elias Gilbert is a conductor and clarinetist from Santa Cruz, California. Elias recently earned a Master of Music in Clarinet Performance from the Peabody Conservatory, where he studied with Alexander Fiterstein. While at Peabody, he served as Music Director of the Johns Hopkins Medical Orchestra, an orchestra of doctors, medical students, and researchers in East Baltimore. He graduated with a Bachelor of Science in Computer Science and Mathematics from Yale University in 2024, where he served as Principal Conductor of the Davenport Pops Orchestra, Music Director of the Yale Undergraduate Chamber Orchestra, and Assistant Conductor of the Yale Symphony Orchestra under William Boughton. This fall, Elias will begin graduate studies in orchestral conducting with Ransom Wilson at the University of Alabama, where he will serve as Music Director of the Campus Orchestra and Assistant Conductor of the Huxford Symphony Orchestra.",affiliations:"",website:""},
    {name:"Zach Nicely",role:"Conducting Scholar",section:"Conducting Scholars",photo:"https://irp.cdn-website.com/1e6f3c7e/dms3rep/multi/zach-nicely-headshot.jpg",link:"",bio:"Zach Nicely is stamping his name in the classical music industry as “the video game music conductor.” He is frequently called as a guest conductor and game music lecturer by ensembles, universities, and conferences across the country. He founded Press Start, a New York orchestra dedicated to programming video game music with classical favorites, where he currently serves as Music Director. \nZach was awarded Third Prize in The American Prize in Orchestral Programming—Vytautas Marijosius Memorial Award for Press Start’s inaugural season. His work caught the attention of the Mannes School of Music, who recruited him to develop such an ensemble for their pre-college program, the Game Orchestra at Mannes Prep. \nAt home with both multimedia and scores born for the stage, Zach has conducted orchestras in Germany, Japan, and across the United States. He previously served as Assistant Conductor with the Litha Symphony Orchestra in New York City. Zach has made guest appearances with the Berliner Symphoniker, Tokyo Sinfonia, MAGFest Orchestra, Awesöme Orchestra Collective, City Lyric Opera, and the Cornell College Chamber Orchestra. In 2025, Zach collaborated with flautist Emily Duncan to record Randall Woolf’s concerto for beatbox flute and string orchestra, “Native Tongues”, on her album Woolf at the Door released by Neuma Records. \nZach actively advocates for the artistic programming of video game music. He was invited to lead a panel titled “The Case for VGM in Orchestral Programming” at the 2025 Super MAGFest and 2024 MAGWest conferences. His essay “Video Game Music: A Connection Beyond the Controller” was published in the Lexia Undergraduate Journal in Writing, Rhetoric, and Technical Communication by the first unanimous vote of the journal’s editorial committee. He founded the Press Start Publishing company to fill the gap of properly licensed sheet music currently preventing most orchestras from performing this genre of contemporary classical music. \nWhile touring with the WMU Symphony Orchestra, he organized and conducted an interactive rehearsal and concert, The Smash Experiment, featuring an orchestra playing video game scores in real time as audiences played the games themselves. Zach was awarded Western Michigan University’s Signature Designation in Leadership for this performance.",affiliations:"",website:""},
    {name:"Paola Budani",role:"Piano Fellow",section:"Orchestral Fellows",photo:"https://irp.cdn-website.com/1e6f3c7e/dms3rep/multi/paola-budani-headshot.jpg",link:"",bio:"Paola Budani is an internationally Albanian pianist specializing in solo performance, collaborative piano and chamber music. She has performed widely across Europe and the United States, appearing in major festivals and venues including Carnegie Hall, National Theater of Opera and Ballet in Tirana, Chopin Fest Pristina, Nei Suoni Dei Luoghi Festival in Italy, Different Trains Chamber Music Festival, and the Society of Composers Region II Conference Concert in New York.\nShe is highly regarded as a collaborative pianist, having received the Outstanding Pianist Collaborative Award at the Antonio Janigro International Cello Competition in Croatia and serving as the official accompanying pianist for the Gjiroclassica International Competition. Paola has also worked extensively with vocalists and instrumentalists in academic and professional settings, including her role as pianist for the Crouse Choral and Setnor Sonority Mixed Choir at Syracuse University.\nHer academic background includes a Bachelor’s degree from the University of Arts in Tirana, a Master’s degree from Syracuse University, and current doctoral degree studies (DMA) at the University of Nevada, Reno, under Dr. Hyeyeon Park. Her honors include the Yamaha Scholarship for the Best Student, the Gayle Ross Pianist Prize, and the Setnor School Concerto Competition Award.\nWith strong international experience, a deep commitment to contemporary music and a passion for artistic collaboration, Paola Budani continues to built a versatile and dynamic career as a performer.",affiliations:"",website:""},
    {name:"Xenia Susha Edwards",role:"Violin Fellow",section:"Orchestral Fellows",photo:"https://irp.cdn-website.com/1e6f3c7e/dms3rep/multi/xenia-susha-edwards.JPG",link:"",bio:"Xenia (Susha) Edwards is a violinist and violist originally from London, England. She began playing the violin at age 7 and studied at the Tchaikovsky Central Music School and then attended the Royal College of Music Junior Department in London, where she started viola lessons. An enthusiastic orchestral and chamber musician, Susha attended the Aspen Music Festival and School, served as concertmaster of the National Symphony Orchestra Summer Music Institute Orchestra, was a member of the New York Youth Symphony and has enjoyed subbing for the New World Symphony as well as playing viola at the Yellow Barn Young Artists Program. She also enjoys playing for musical theatre productions and Off-Broadway in NYC. Susha has performed at venues in the UK and the US such as Alice Tully Hall, Carnegie Hall, the Arsht Center, the Kennedy Center, and Cadogan Hall. Outside of performing, she worked as a Teaching Assistant at CMS of Lincoln Center, and at Columbia University for Psychology. She graduated this year from Columbia with a Bachelor’s in Psychology and Music Performance whilst studying with Naoko Tanaka. She is excited to continue her musical studies with her Master’s in Performance at the Royal College of Music this September!",affiliations:"",website:""},
    {name:"Angela Fiedler",role:"Violin Fellow",section:"Orchestral Fellows",photo:"https://irp.cdn-website.com/1e6f3c7e/dms3rep/multi/angela-fiedler-headshot.jpg",link:"",bio:"From Middletown, NY, Angela Fiedler holds a summa cum laude bachelor's degree in Violin Performance from Purchase Conservatory of Music and a Master of Music degree from Lynn Conservatory under the tutelage of Carmit Zori and Carole Cole, respectively.\n\nWhile living in South Florida, Angela became a member of the Palm Beach Symphony and Florida Grand Opera. She also regularly appeared in Candlelight Concerts by Fever in multiple cities. Angela has shared the stage with many talented artists including Pinchas Zuckerman, Joshua Bell, Gil Shaham, and others. She will be joining Josh Groban at Bethel Woods in August 2026. Her summer festival appearances include Spoleto Festival USA, Meadowmount, and Eastern Music Festival.\n\nA chamber music enthusiast, Angela and her quartet tied for first place in the 2022 Molnar-Harris Chamber Music Competition at SUNY Purchase. Additionally, her quartet earned third place in the 2023 Lynn Conservatory Chamber Music Competition. In 2023, Angela made her solo debut with Lynn Philharmonia as a winner of the Lynn Conservatory Concerto Competition.\n\nIn 2025, Angela moved back to New York to freelance in the Hudson Valley and New York City. She was appointed concertmaster of the Woodstock Symphony in early 2026. Angela is a member of the Northern Dutchess Symphony, Greater Newburgh, and Westchester Symphony Orchestras. Further, she has performed with Orchestra Lumos, the Hudson Valley Symphony Orchestra, and the Ridgefield Symphony.\n\nOutside of performing, Angela has an extensive private studio in Westchester, NY. In her free time, Angela enjoys taking her dogs to the dog park and reading a good book.",affiliations:"",website:""},
    {name:"Dennis Fleitz",role:"Cello Fellow",section:"Orchestral Fellows",photo:"https://irp.cdn-website.com/1e6f3c7e/dms3rep/multi/dennis-fleitz-headshot.jpg",link:"",bio:"Dennis Fleitz (b.2001) just completed his Master’s in Cello Performance at the Peabody Institute studying with Alan Stepansky. He earned his Bachelor’s degree from the University of Central Florida with David Bjella. At Peabody, he served as principal cellist for the conducting studio of Marin Alsop and held principal roles in multiple cycles of the PSO; at UCF, he was the principal cellist of the UCFSO.\n\nDennis was recently awarded a position in the cohort of the 2026 VSA International Young Musicians Program, for which he is eligible as a musician living with Type 1 Diabetes. In 2024, he won second prize in the final round of the Music Teachers National Association Young Artists Competition and has participated in the Bowdoin and Aspen Music Festivals.\n\nWhen he’s not practicing cello, Dennis spends much of his time composing and singing. His passion for composing has led to successful commissions including the Round Top Music Festival Cello Section. Recently, after a program of Beethoven and Schumann, he performed Beatles music where he sang and played the guitar parts on cello. He continues to find excitement in all disciplines of art and he looks forward to continuing his studies at Yale.",affiliations:"",website:""},
    {name:"Hyunwoo Jeoung",role:"Viola Fellow",section:"Orchestral Fellows",photo:"https://irp.cdn-website.com/1e6f3c7e/dms3rep/multi/JeoungAndy-headshot.png",link:"",bio:"Hyunwoo Jeoung, born in South Korea, began studying the viola at age 12 in Columbus, Ohio. Jeoung received a Bachelor of Music degree from Baldwin Wallace University. Jeoung’s main teachers include Steven Wedell, Lembi Veskimets, Vicky Chiang, and Rebecca Albers.\n\nA passionate orchestral musician, Jeoung is attending TŌN at Bard where he received a full tuition scholarship with living stipends. In addition, he has performed in the Atlanta Symphony Orchestra, National Repertory Orchestra, Savannah Philharmonic Orchestra, Erie Philharmonic Orchestra, and more. Jeoung is currently a tenured member of the Youngstown Symphony Orchestra.\n\nJeoung aspires to be a versatile solo and chamber musician outside of his orchestral career. He was a semifinalist for the 2024 William C. Byrd Young Artist Competition, and placed 3rd in the New Albany Student Concerto Competition. Jeoung has attended the Green Mountain Summer Music Festival, and will be attending the Eastern Festival of Music as an orchestral fellow.\n\nOutside of viola playing, Jeoung is also very eager to study conducting and dreams to conduct professionally one day. He has appeared as a guest conductor of the Baldwin Wallace University Symphony Orchestra.",affiliations:"",website:""},
    {name:"Robert Lenau",role:"Percussion Fellow",section:"Orchestral Fellows",photo:"https://irp.cdn-website.com/1e6f3c7e/dms3rep/multi/RobertLenauHeadshot-826abcd7.jpg",link:"",bio:"A native of South Plainfield, New Jersey, Robert Lenau joined the Ann Arbor Symphony Orchestra as section percussionist in September 2025. Robert has had the privilege of working under notable conductors Antonio Pappano, Stéphane Denève, Jaime Laredo, David Alan Miller, and Earl Lee. In 2024, he served as the timpanist for the New York String Orchestra Seminar and was also a percussion fellow with Orchestra Next. He has performed as guest percussionist with New Jersey Symphony, Albany Symphony, Symphony New Hampshire, and New World Symphony.\nRobert holds a Bachelor’s Degree from Rutgers University and a Master’s Degree from Boston University. His primary teachers have included Joseph Tompkins, Ian Sullivan, Timothy Genis, Samuel Solomon, and Kyle Brightwell. During the summers, he has participated in programs at Festival Napa Valley, Orchestre de la Francophonie, and Eastern Music Festival.",affiliations:"",website:""},
    {name:"Yanjue Lin",role:"Piano Fellow",section:"Orchestral Fellows",photo:"https://irp.cdn-website.com/1e6f3c7e/dms3rep/multi/Yanjue-Lin-headshot.jpg",link:"",bio:"Yanjue Lin is a classically trained pianist. She attended the Artist Diploma program at the Frost School of Music at the University of Miami, earned a Doctor of Musical Arts in Piano Performance from Shenandoah University, and a Master of Music in Piano Performance from the Royal Conservatoire of Scotland. She has studied with Santiago Rodríguez and Marika Bournaki, and has participated in masterclasses with John O’Conor, Anton Nel, Anne-Marie McDermott, Victor Rosenbaum, Jonathan Plowright, Fali Pavri, Roy Howat, and other distinguished artists.\n\nIn addition to her solo training, she has experience in chamber music and orchestral performance. She served as a piano fellow at the Atlantic Music Festival and is a piano fellow at the Eastern Music Festival, where she works closely with faculty artists and fellow musicians in collaborative settings. In orchestral performance, she served as a keyboardist with the Frost Symphony Orchestra under Maestro Gerard Schwarz.\n\nShe currently performs as principal keyboardist with the Wayzata Symphony Orchestra and as a substitute orchestral keyboardist with several orchestras, including the New World Symphony and the Rochester Symphony Orchestra in Minnesota. In addition, she has served as Assistant Artistic Director of the Rochester Chamber Music Society (Minnesota) since 2025.",affiliations:"",website:""},
    {name:"Matthew Reffner",role:"Cello Fellow",section:"Orchestral Fellows",photo:"https://irp.cdn-website.com/1e6f3c7e/dms3rep/multi/matthew-reffner-headshot.jpg",link:"",bio:"Matthew Reffner, 23, is a student currently attending Shenandoah Conservatory and is\nstudying cello performance under the instruction of Julian Schwarz for his Masters Degree. At Shenandoah Conservatory, during his Undergraduate Degree, Matthew has been Principal of the Symphonic Orchestra and has performed works such as, Beethoven’s Symphony No.8, Ravel’s Piano Concerto in G Major, Poulenc’s Piano Concerto in C# minor, and Britten: A Midsummer Night’s Dream. As a versatile musician, he has also performed in the conservatory’s pit in works such as Into the Woods and Tuck Everlasting. Matthew has attended the Eastern Music Festival in the summer of 2023 and 2024 and has also attended the Philadelphia International Music Festival. He took his studies in Summer of 2025 to the Brevard Summer Music Festival Orchestral Institute. In 2023, He toured to Argentina with the Shenandoah Conservatory Symphony Orchestra, performing Mahler’s fifth symphony in various cities. Matthew has participated in masterclasses held by John Koen, Patrick Jee, Lluis Claret, Amit Peled, Shar Prescott, and Gloria dePasquale. In efforts to expand his career, Matthew has begun to take professional orchestra auditions. He has won a seat in the Fredericksburg Symphony and Northern Neck Orchestra. Matthew has also won sub positions in the Roanoke Symphony and West Virginia Symphony.",affiliations:"",website:""},
    {name:"Emma Selmon",role:"Clarinet Fellow",section:"Orchestral Fellows",photo:"https://irp.cdn-website.com/1e6f3c7e/dms3rep/multi/Emma-Selmon-headshot.JPG",link:"",bio:"Emma Selmon is a clarinetist and bass clarinetist based in the Washington, D.C. area. She is currently a doctoral candidate at the University of Maryland, College Park.\nAn active freelancer, Selmon is a substitute player for several orchestras, including the Annapolis Symphony Orchestra, the Allentown Symphony Orchestra and the York Symphony Orchestra. Other recent engagements include several shows with the Color of Noize Orchestra on Jeezy’s TM:101 Live tour last summer as well as performances at the Olney Theatre Center and the Baltimore Basilica. She has served as a contemporary performance clarinet and bass clarinet fellow at the Atlantic Music Festival, and her playing can be heard on “Uproot: Greek Refugee Songs from Asia Minor,” a July 2024 album released by the Kombos Collective.\nAt the University of Maryland, Selmon served as the clarinet studio graduate assistant, where she was the instructor of record for undergraduate minor clarinet students, taught a technique studio class to undergraduate clarinet majors, and coordinated a mixed clarinet choir comprising local professional, amateur and university student clarinetists. Her dissertation research explores the concept of light music, a broad term that constitutes a middle ground between classical and popular music.",affiliations:"",website:""},
    {name:"Christian Alejandro Cherubini Suárez",role:"Viola Fellow",section:"Orchestral Fellows",photo:"https://irp.cdn-website.com/1e6f3c7e/dms3rep/multi/Christian-Alejandro-Cherubini+Sua-rez-headshot.jpeg",link:"",bio:"Christian Alejandro Cherubini Suárez is a Venezuelan violist, composer, and audio technician currently pursuing dual Master of Music degrees in Viola Performance and Composition at the University of Oklahoma. He previously earned undergraduate degrees in the same fields from Jacksonville University.\n\nBorn in Caracas, Venezuela, Cherubini began studying music at age six at the Emil Friedman School, where he was selected to study viola through its conservatory program. Since moving to the United States in 2017, he has remained active as both performer and composer.\n\nHis performance experience includes Orquesta Típica Emil Friedman, Arcos y Voces Juveniles de Caracas, Florida Symphony Youth Orchestra, Encuentros Orchestra, and university orchestras in Florida and Oklahoma. In addition to viola, he performs percussion with the University of Oklahoma Civic Orchestra and plays Venezuelan cuatro. He also works as a Sound Booth Technician at the University of Oklahoma and as a freelance audio and video technician, contributing to recording, production, and performance projects. His creative work includes electroacoustic music and interactive audio-visual systems using Max/MSP and Jitter.",affiliations:"",website:""},
    {name:"Siana Wong",role:"Violin Fellow",section:"Orchestral Fellows",photo:"https://irp.cdn-website.com/1e6f3c7e/dms3rep/multi/Siana-Wong-headshot.jpg",link:"",bio:"Siana Wong is a native of Greensboro, North Carolina with family roots in Malaysia. She has won the Winston-Salem Symphony Youth Orchestra, Greensboro Symphony Youth Orchestra, UNC Chapel Hill, and UNC Greensboro concerto competitions. She holds a Bachelor of Music from UNC Chapel Hill and a Performance Certificate from UNCG. Siana is a champion of contemporary music and an avid chamber musician in and out of her home state of North Carolina, including performances with Eastern Festival of Music and UNCG faculty. Siana has spent many summers at the original Richard Luby Violin Symposium, where she had the opportunity to learn from first-class violinists from around the globe. Currently, she has been selected as a String Fellow at Eastern Festival of Music to perform with the Faculty Orchestra.\n\nSiana is a member of Fayetteville Symphony Orchestra, Western Piedmont Symphony, and Associate Concertmaster of Greensboro Symphony Orchestra. In addition to her performing career, she is committed to advancing youth music education while fostering meaningful community engagement.\n\nSiana is extending her studies at UNCG, pursuing a Master of Music with Professor Fabián López.\n\nShe plays on a Wojciech Topa violin from 2017 and a bow by Victor Fétique.",affiliations:"",website:""},
    {name:"Yue Yang",role:"Violin Fellow",section:"Orchestral Fellows",photo:"https://irp.cdn-website.com/1e6f3c7e/dms3rep/multi/yue-yang-headshot.jpg",link:"",bio:"Violinist Yue Yang, praised for her “bright and mellifluous tone,” is currently pursuing a Doctor of Musical Arts degree under the tutelage of Professor Kurt Sassmannshaus at the University of Cincinnati College-Conservatory of Music. Having recently completed her coursework in Cincinnati, she is now based in Las Vegas.\n\nBorn in Panzhihua, China, Yue began studying the violin at the age of four. Although music was always an important part of her life, it was during her undergraduate studies at Bryn Mawr College that she decided to pursue music professionally. Yue later earned a Master of Music degree and a Professional Performance Certificate from the Lynn Conservatory. Since then, she has appeared as a soloist with school, festival, and professional orchestras, and has performed extensively in professional chamber ensembles and orchestras. In addition to performing, Yue enjoys teaching and working closely with her private students. From 2019 to 2021, Yue performed in the first violin section of the Ningbo Symphony Orchestra and also appeared as a soloist with the orchestra. Having previously attended Eastern Music Festival from 2022 to 2024, Yue is excited to return as part of the inaugural season of the newly reimagined Eastern Festival of Music.",affiliations:"",website:""},
    {name:"Jacob Leshnower",role:"Percussion Fellow",section:"Orchestral Fellows",photo:"https://irp.cdn-website.com/1e6f3c7e/dms3rep/multi/jacob-leshnower-headshot.jpg",link:"",bio:"Jacob Leshnower is a percussionist at Yale University from Long Island, New\nYork. At Yale, he is a member and officeholder of the Yale Symphony Orchestra, which toured internationally in 2025 to Greece and North Macedonia. He is also a member of the Yale Wind Ensemble, which toured internationally in 2025 to the United Kingdom. Jacob has performed with the Yale Philharmonia, Camerata, Glee Club, Schola Cantorum, Berkeley College Orchestra, Davenport Pops Orchestra, Undergraduate Chamber Orchestra, Opera, Dramat, Artists Cabaret, and more. Jacob played percussion in the December 2024 premiere of Darwin en Patagonia, the first collaboration between Yale Opera and Yale College Arts, and was selected in 2024 for the CBDNA Intercollegiate Band at Cornell University. Jacob additionally enjoys playing piano with the Yale Undergraduate Piano Collective. He has attended summer programs at Sewanee, Juilliard, Tanglewood, NYU, Princeton, Rice, and Northwestern, and appears on Sō Percussion’s 2025 album 25x25. Before attending Yale, Jacob was a From the Top finalist, featured by NPR’s “Daily Joy,” and performed with the NAfME All-National Symphony Orchestra. He aspires to a career as a classical percussionist.",affiliations:"",website:""},
    {name:"Corey Nance",role:"Trombone Fellow",section:"Orchestral Fellows",photo:"https://irp.cdn-website.com/1e6f3c7e/dms3rep/multi/corey-nance-headshot.jpg",link:"",bio:"Corey Nance is an active musician and educator based in Broomfield, Colorado pursuing a Doctorate of Musical Arts in Trombone Performance and Pedagogy at the University of Colorado Boulder. He currently holds the position of Principal Trombone with the Boulder Symphony, Longmont Symphony, and the Symphony of the Rockies where he recently performed the Lars Erik-Larsson Concertino for Trombone. As an educator, he has presented at the 2023 Big 12 Trombone Conference and the 2023 International Trombone Festivals while completing his Bachelor of Music from West Texas A&M University with a youth trombone choir he founded named the Buff Bone Initiative. In the Spring of 2025 he replicated this initiative at the University of Colorado Boulder with the Sko Bone Project during his Master of Music. Corey has had the pleasure of participating in a number of festivals across the world and is proud to have attended the Southeast Trombone Symposium, Southwest Trombone Conference, and the Punto Arte Festival. He is currently completing an Artist Diploma with OAcademy and holds degrees from West Texas A&M University and the University of Colorado Boulder.",affiliations:"",website:""},
    {name:"Juan-David Dominguez",role:"Conducting Scholar",section:"Conducting Scholars",photo:"",link:"",bio:"Coming Soon",affiliations:"",website:""},
    {name:"Carter Reynolds",role:"Conducting Scholar",section:"Conducting Scholars",photo:"https://irp.cdn-website.com/1e6f3c7e/dms3rep/multi/Carter-Reynolds-headshot.jpg",link:"",bio:"Conductor and flutist Carter Reynolds is a 1st-year MM student at the Yale School of Music studying Flute Performance under Tara Helen O’Connor, where he also serves as assistant conductor for the Yale Graduate Student Orchestra. Additionally, as a paraprofessional teaching artist through the Music in Schools Initiative, he enjoys working with students in New Haven public schools. His multidimensional artistic perspective is inseparable from his belief in the responsibility of musicians to be in dialogue with, and act in service to, the world around them. Recent summer engagements include the Fort Worth Conducting Institute and Chautauqua Institution in 2025, as well as Eastern Music Festival, where he was named a winner of the 2024 Concerto Competition. Previously, Carter studied Flute Performance and Music Education under Terri Sundberg at the University of North Texas (BM 2025), where he was also a semifinalist in the concerto competition and member of Kappa Kappa Psi. Upon the completion of his program at Yale, Carter plans to pursue formal study in orchestral conducting.",affiliations:"",website:""},
    {name:"Victor Shlyakhten",role:"Conducting Scholar",section:"Conducting Scholars",photo:"https://irp.cdn-website.com/1e6f3c7e/dms3rep/multi/Victor-Shlyakhtenko-headshot.jpeg",link:"",bio:"Pianist and conductor Victor Shlyakhtenko brings a dual perspective to the podium. He made his conducting debut in 2019 with the South Coast Symphony in California, leading Tchaikovsky’s Romeo and Juliet Overture, and has since participated in masterclasses with Radu Paponiu, Kirk Trevor, Neil Varon, and Diane Wittry. As a pianist, he has appeared with over a dozen orchestras in concertos by Beethoven, Brahms, Chopin, Grieg, Liszt, Mendelssohn, Tchaikovsky, and Clara Schumann, with recent performances alongside the Panama City Symphony in Florida and the Delta Symphony Orchestra in Arkansas. He has presented recitals for the Grand Piano Series in Naples and the Palm Springs International Piano Competition, and his solo performances have taken him to Carnegie Hall, Jay Pritzker Pavilion, Leipzig Gewandhaus, and Walt Disney Concert Hall. Born and raised in Los Angeles, he began his training at the Colburn School of Performing Arts, later earning a Bachelor’s Degree in Piano Performance from the Oberlin Conservatory. His principal teachers have included Fabio Bidini, Stanislav Ioudenitch, and José Ramón Méndez. He is an alumnus of the Lang Lang International Music Foundation’s Young Scholars Program. This fall, he continues his studies as a Master of Music candidate in Orchestral Conducting at the Frost School of Music, where he will work under the direction of Gerard Schwarz.",affiliations:"",website:""},
    {name:"Wrenn Mokry",role:"Bassoon/Contrabassoon Fellow",section:"Orchestral Fellows",photo:"https://irp.cdn-website.com/1e6f3c7e/dms3rep/multi/Wrenn-Mokry-Headshot.jpg",link:"",bio:"Wrenn Mokry is a bassoonist, contrabassoonist, composer, and improviser currently based in Baltimore, whose focus is on working closely with artists of all types and trades to create unique musical experiences that push aesthetic boundaries while endeavoring to remain accessible to audiences. They are also an esteemed orchestral and chamber musician, having served as principal bassoon in the inaugural season of The Westside Chamber Players, and playing with ensembles such as The Chelsea Symphony and Park Avenue Chamber Symphony, as well as having played as a soloist at MISE-EN_PLACE. Currently, they are working on writing a method book geared towards teaching multiphotonics to advanced bassoonists and providing composers with examples of ways to use multiphonics in their pieces other than just as or effect, as well as a series of pieces designed to be played in conjunction with live fluorescent mineral displays, which is their main passion outside of music.",affiliations:"",website:""},
    {name:"Andrew Stewart",role:"Cello Fellow",section:"Orchestral Fellows",photo:"https://irp.cdn-website.com/1e6f3c7e/dms3rep/multi/andrew-stewart-headshot.jpeg",link:"",bio:"A native of Lakeland, Florida, cellist and educator Andrew Stewart (b. 2001) is currently pursuing an Artist Diploma in Cello Performance at Shenandoah University, where he studies with Professor Julian Schwarz. He is an active orchestral and chamber musician, serving as a principal cellist of the Shenandoah Conservatory Symphony Orchestra and performing regularly in a variety of chamber ensembles. He is also a founding member of a newly formed piano trio with Eoín Fleming and Jonathan Toomer.\n\nAndrew’s passion for teaching is rooted in an athletic and analytical approach to cello technique, emphasizing body mechanics, physical awareness, and efficient movement as foundations for expressive playing. He maintains a private cello studio of students ranging from ages 6 to 65, where he combines the Suzuki method with traditional repertoire, etudes, and orchestral excerpts to develop strong technical and musical foundations. Through his graduate assistantship at Shenandoah University, Andrew has taught applied lessons, led studio classes, and presented masterclasses for prospective students.",affiliations:"",website:""},
    {name:"Devin Ascioti",role:"Cello Fellow",section:"Orchestral Fellows",photo:"https://irp.cdn-website.com/1e6f3c7e/dms3rep/multi/devin-ascioti-headshot.jpg",link:"",bio:"Devin Ascioti is a double bassist from Carmel, Indiana. He recently received his Bachelor of Music in Double Bass Performance from the Indiana University Jacobs School of Music, studying with Kurt Muroki. Other teachers include Jeffrey Turner, Lawrence Hurst, and Robert Goodlett.\n\nAn active musician, Ascioti has performed as an orchestral fellow at the Pacific Music Festival, the New York String Orchestra Seminar, the National Orchestral Institute, the Round Top Festival Institute, and the Lake George Music Festival. He has participated in masterclasses with many distinguished bassists, including Michael Bladerer, Alex Hanna, Timothy Dilenschneider, Braizahn Jones, Nina DeCesare, Ian Hallas, and Erik Harris.\n\nBeginning in the fall of 2026, Devin will pursue a Master of Music degree at the Juilliard School, studying with Joseph Conyers.",affiliations:"",website:""},
    {name:"Cipriano Valdez-Bell",role:"Viola Fellow",section:"Orchestral Fellows",photo:"https://irp.cdn-website.com/1e6f3c7e/dms3rep/multi/Cy-Bell-Headshot.jpg",link:"",bio:"Cipriano Valdez-Bell is a recent graduate in viola performance. He earned a Bachelor's degree from Southern Methodist University and a Master’s degree from The Frost School of Music at the University of Miami. His primary teachers are Barbara Sudweeks and Jodi Levitz.  Allyson Dawkins, Charles Castleman, Michael Ouzounian, and Kevin Garcia-Hettinger have also been significant mentors.\n\nHailing from Leon Springs, Texas, Cy has served as Principal Viola of the Meadows Symphony Orchestra at Southern Methodist University, the Frost Symphony Orchestra and Frost Repertory Orchestra at the Frost School of music, and the World Youth Symphony Orchestra at the Interlochen Arts Camp. He has also served as Associate Principal Viola of the Blackburn Academy Orchestra and Opera Scenes Orchestra at Festival Napa Valley. While at these institutions, he has performed under the baton of Cristian Măcelaru, Mei-Ann Chen, Jung-Ho Pak, and Gerard Schwarz. While at Frost, Cy was a fellow at the Henry Mancini Institute, where he played in the Henry Mancini Institute Orchestra. He has also performed with the Palm Beach Symphony and the San Antonio Philharmonic.\n\nAs a chamber musician and soloist, Cy was a finalist in the Coltman Chamber Music Competition in 2019 with the Brandeis High School String Quartet, and has received coachings and masterclasses from ensembles such as the Viano String Quartet, and the Dover String Quartet, and Camerata San Antonio. He has also worked with Phillip and David Ying. Cy was a finalist in the Tuesday Musical Club Competition and was a soloist with the group. He attended the Castleman Quartet Program for the summers of 2022-2025, and also served as Assistant Dean for the summers of 2024-2025.",affiliations:"",website:""},
    {name:"Glen Kuenzi",role:"Violin Fellow",section:"Orchestral Fellows",photo:"https://irp.cdn-website.com/1e6f3c7e/dms3rep/multi/Glen-Kuenzi-headshot.jpg",link:"",bio:"Glen Kuenzi hails from Madison, Wisconsin. He completed his B.S in Violin Performance and Economics at the University of Wisconsin (2022), and M.M. in Violin Performance at the University of Maryland (2024). Since then, he made Washington, DC his home base and has become well established as an orchestral player on the East Coast and Midwest. He is currently a member of the Annapolis, Fairfax, West Virginia, and Madison Symphony Orchestras, and subs with the Virginia Symphony and Erie Philharmonic. He is also a passionate chamber musician and music educator, collaborating with colleagues in the DC area, and teaching at the Annapolis Symphony Academy. Outside of music, Glen is an avid golfer, nature lover, and private pilot.",affiliations:"",website:""},
    {name:"Michael Wu",role:"Violin Fellow",section:"Orchestral Fellows",photo:"https://irp.cdn-website.com/1e6f3c7e/dms3rep/multi/Michael-Wu-Headshot.png",link:"",bio:"Michael Z. Wu is a violinist, educator, and chamber musician whose artistic approach is informed by the pedagogical traditions of Ivan Galamian, Dorothy DeLay, and the\nRussian school of violin playing. Praised by the South Florida Classical Review for his “precise” and “glistening” tone, he has appeared as a soloist, chamber musician, and\norchestral performer throughout the United States.\nAs a soloist, Michael performed the Barber Violin Concerto with the Frost Symphony Orchestra, earning critical acclaim for a performance noted for its expressive depth, clear intonation, and technical command. He has held numerous leadership positions, including Resident Concertmaster of the Frost Repertory Orchestra, Concertmaster of the Frost Symphony Orchestra, Concertmaster of Ensemble Ibis, and Concertmaster of the Peabody Modern Orchestra. His professional orchestral experience includes performances with Palm Beach Symphony, Symphony of the Americas, Florida Grand Opera, Miami Chamber Orchestra, and Orchestra Manhattan.\nIn addition to his work in the classical repertoire, Michael has performed with the Henry Mancini Institute and the Philharmonic Orchestra Project (POP), collaborating with\nEmmy Award-winning Latin producers and artists in projects that blend orchestral performance with contemporary commercial and popular music.\nMichael holds degrees from the Eastman School of Music, the Peabody Conservatory, and the Frost School of Music at the University of Miami, where he earned the Doctor of\nMusical Arts degree in Violin Performance.",affiliations:"",website:""}
  ];

  /* ====================== ENGINE (no need to edit below) ====================== */
  var host, titleEl, tabsBar;
  var panels = {}, roots = {}, statuses = {};
  var allPeople = [];

  function setStatus(el, msg){
    if(!el) return;
    if(msg){ el.textContent = msg; el.hidden = false; }
    else { el.hidden = true; }
  }
  function setAllStatus(msg){
    TABS.forEach(function(t){ setStatus(statuses[t.key], msg); });
  }

  /* RFC-4180-ish CSV parser: handles quoted fields, commas & newlines inside
     quotes, and "" escaped quotes. Returns an array of string arrays. */
  function parseCSV(text){
    var rows = [], row = [], field = "", inQ = false, i = 0, c;
    text = String(text).replace(/\r\n/g,"\n").replace(/\r/g,"\n");
    for(; i < text.length; i++){
      c = text[i];
      if(inQ){
        if(c === '"'){
          if(text[i+1] === '"'){ field += '"'; i++; }
          else { inQ = false; }
        } else { field += c; }
      } else {
        if(c === '"'){ inQ = true; }
        else if(c === ','){ row.push(field); field = ""; }
        else if(c === '\n'){ row.push(field); rows.push(row); row = []; field = ""; }
        else { field += c; }
      }
    }
    row.push(field); rows.push(row);
    // drop a single trailing empty line
    if(rows.length && rows[rows.length-1].length === 1 && rows[rows.length-1][0] === "") rows.pop();
    return rows;
  }

  /* Columns are matched by HEADER NAME (any alias below), never by position, so
     the sheet columns can be added / removed / reordered freely. */
  var ALIASES = {
    name:["name","fellow","full name","full_name","artist","person","musician","scholar"],
    role:["role","title","instrument","position","roles","subtitle","fellowship"],
    section:["section","group","department","category","ensemble","instrument group","type"],
    photo:["photo","image","headshot","picture","img","photo url","image url","photourl","headshot url","portrait"],
    link:["link","page","page url","bio link","biolink","profile url","profile page","profile link"],
    bio:["bio","biography","about","description","blurb","bio text","profile","notes"],
    affiliations:["affiliations","affiliation","orgs","organizations","memberships","positions","ensembles"],
    website:["website","web","site","homepage","personal website","personal site","url","web url","external url","www"]
  };
  function headerMap(headerRow){
    var map = {};
    headerRow.forEach(function(h, idx){
      var key = String(h == null ? "" : h).trim().toLowerCase();
      Object.keys(ALIASES).forEach(function(field){
        if(map[field] === undefined && ALIASES[field].indexOf(key) !== -1) map[field] = idx;
      });
    });
    return map;
  }
  function cell(row, idx){ return idx === undefined ? "" : String(row[idx] == null ? "" : row[idx]).trim(); }
  function toObj(map, row){
    return {
      name: cell(row, map.name),
      role: cell(row, map.role),
      section: cell(row, map.section) || "Orchestral Fellows",
      photo: cell(row, map.photo),
      link: cell(row, map.link),
      bio: cell(row, map.bio),
      affiliations: cell(row, map.affiliations),
      website: cell(row, map.website)
    };
  }
  function rowsToData(rows){
    if(!rows || !rows.length) return [];
    var map = headerMap(rows[0]);
    var body = rows.slice(1);
    if(map.name === undefined){
      // No header we recognize -> assume positional columns and keep row 0.
      map = { name:0, role:1, section:2, photo:3, link:4, bio:5, affiliations:6, website:7 };
      body = rows;
    }
    return body.map(function(r){ return toObj(map, r); }).filter(function(o){ return o.name; });
  }

  /* ---- tiny, SAFE Markdown -> HTML (for bios) ----
     Escapes all HTML first, then re-introduces only **bold**, *italic*,
     [text](url) links, bullet lists, line breaks and blank-line paragraphs.
     A pasted <script> can never execute: it is escaped before anything runs. */
  function escapeHtml(s){
    return String(s).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;");
  }
  function safeUrl(u){
    u = String(u).trim();
    if(/^(javascript|data|vbscript):/i.test(u)) return "#";
    if(/^(https?:|mailto:|tel:|#|\/|\.\/|\.\.\/)/i.test(u)) return u;
    if(/^[a-z0-9.\-]+\.[a-z]{2,}([\/?#].*)?$/i.test(u)) return "https://" + u; // bare domain
    return "#";
  }
  function mdInline(text){
    var links = [];
    text = text.replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, function(_, t, u){
      links.push('<a href="' + safeUrl(u) + '" target="_blank" rel="noopener noreferrer">' + t + "</a>");
      return "@@LNK" + (links.length - 1) + "@@";
    });
    text = text.replace(/(\*\*|__)(?=\S)([\s\S]+?\S)\1/g, "<strong>$2</strong>");
    text = text.replace(/(\*|_)(?=\S)([\s\S]+?\S)\1/g, "<em>$2</em>");
    return text.replace(/@@LNK(\d+)@@/g, function(_, i){ return links[+i]; });
  }
  function mdToHtml(md){
    md = String(md == null ? "" : md).replace(/\r\n/g,"\n").replace(/\r/g,"\n").trim();
    if(!md) return "";
    return escapeHtml(md).split(/\n\s*\n/).map(function(block){
      block = block.replace(/^\n+|\n+$/g,"");
      if(!block) return "";
      var lines = block.split("\n");
      if(lines.every(function(l){ return /^\s*[-*]\s+/.test(l); })){
        return "<ul>" + lines.map(function(l){ return "<li>" + mdInline(l.replace(/^\s*[-*]\s+/,"")) + "</li>"; }).join("") + "</ul>";
      }
      return "<p>" + lines.map(mdInline).join("<br>") + "</p>";
    }).join("");
  }
  /* split an Affiliations cell into individual items (accepts B7, |, ;, or new lines) */
  function splitItems(s){
    return String(s == null ? "" : s).split(/\s*[·|;]\s*|\n+/).map(function(x){ return x.trim(); }).filter(Boolean);
  }

  /* ---- bio modal (built once, reused) ---- */
  var modal, modalAvatar, modalName, modalRole, modalBio, modalAffilWrap, modalAffilItems, modalWebWrap, modalWebLink, modalLink, modalClose, lastFocus;
  function buildModal(){
    if(modal) return;
    modal = document.createElement("div");
    modal.className = "efmfl-modal"; modal.hidden = true;
    modal.setAttribute("role","dialog"); modal.setAttribute("aria-modal","true"); modal.setAttribute("aria-labelledby","efmfl-modal-name");
    modal.innerHTML =
      '<div class="efmfl-modal__backdrop" data-efmfl-close></div>' +
      '<div class="efmfl-modal__panel" role="document">' +
        '<button type="button" class="efmfl-modal__close" data-efmfl-close aria-label="Close">×</button>' +
        '<div class="efmfl-modal__head">' +
          '<span class="efmfl-modal__avatar"></span>' +
          '<div><div class="efmfl-modal__name" id="efmfl-modal-name"></div><div class="efmfl-modal__role"></div></div>' +
        '</div>' +
        '<div class="efmfl-modal__bio"></div>' +
        '<div class="efmfl-modal__affil" hidden><div class="efmfl-modal__label">Affiliations</div><div class="efmfl-modal__affil-items"></div></div>' +
        '<div class="efmfl-modal__web" hidden><div class="efmfl-modal__label">Website</div><a class="efmfl-modal__weblink" target="_blank" rel="noopener noreferrer" href="#"></a></div>' +
        '<a class="efmfl-modal__link" href="#">View full page &rarr;</a>' +
      '</div>';
    host.appendChild(modal);
    modalAvatar = modal.querySelector(".efmfl-modal__avatar");
    modalName = modal.querySelector(".efmfl-modal__name");
    modalRole = modal.querySelector(".efmfl-modal__role");
    modalBio = modal.querySelector(".efmfl-modal__bio");
    modalAffilWrap = modal.querySelector(".efmfl-modal__affil");
    modalAffilItems = modal.querySelector(".efmfl-modal__affil-items");
    modalWebWrap = modal.querySelector(".efmfl-modal__web");
    modalWebLink = modal.querySelector(".efmfl-modal__weblink");
    modalLink = modal.querySelector(".efmfl-modal__link");
    modalClose = modal.querySelector(".efmfl-modal__close");
    modal.addEventListener("click", function(e){ if(e.target.hasAttribute("data-efmfl-close")) closeModal(); });
    modal.addEventListener("keydown", function(e){
      if(e.key === "Escape"){ closeModal(); return; }
      if(e.key === "Tab"){
        var f = modal.querySelectorAll('a[href],button:not([disabled])');
        f = Array.prototype.filter.call(f, function(n){ return n.offsetParent !== null || n === modalClose; });
        if(!f.length) return;
        var first = f[0], last = f[f.length-1];
        if(e.shiftKey && document.activeElement === first){ e.preventDefault(); last.focus(); }
        else if(!e.shiftKey && document.activeElement === last){ e.preventDefault(); first.focus(); }
      }
    });
  }
  function openModal(p){
    buildModal();
    modalName.textContent = p.name;
    modalRole.textContent = p.role || "";
    modalRole.style.display = p.role ? "" : "none";
    modalAvatar.innerHTML = "";
    if(p.photo){
      var im = document.createElement("img"); im.src = p.photo; im.alt = p.name;
      im.addEventListener("error", function(){ modalAvatar.innerHTML = ""; modalAvatar.style.display = "none"; }); // unshared/broken -> no avatar
      modalAvatar.appendChild(im); modalAvatar.style.display = "";
    }
    else { modalAvatar.style.display = "none"; }
    modalBio.innerHTML = mdToHtml(p.bio);                 // safe: built only from our escaped renderer
    var affil = splitItems(p.affiliations);
    if(affil.length){
      modalAffilItems.textContent = "";
      affil.forEach(function(a){ var d = document.createElement("div"); d.className = "efmfl-modal__affil-item"; d.textContent = a; modalAffilItems.appendChild(d); });
      modalAffilWrap.hidden = false;
    } else { modalAffilWrap.hidden = true; }
    if(p.website){
      modalWebLink.href = safeUrl(p.website);
      modalWebLink.textContent = String(p.website).replace(/^https?:\/\//i,"").replace(/\/+$/,"");
      modalWebWrap.hidden = false;
    } else { modalWebWrap.hidden = true; }
    if(p.link){ modalLink.href = safeUrl(p.link); modalLink.style.display = ""; } else { modalLink.style.display = "none"; }
    lastFocus = document.activeElement;
    modal.hidden = false;
    modalClose.focus();
  }
  function closeModal(){
    if(!modal) return;
    modal.hidden = true;
    if(lastFocus && lastFocus.focus) lastFocus.focus();
  }

  function initials(name){
    var p = name.split(/\s+/).filter(Boolean);
    return ((p[0] ? p[0][0] : "") + (p.length > 1 ? p[p.length-1][0] : "")).toUpperCase();
  }
  function avatarEl(p){
    var tag = p.link ? "a" : "span";
    var av = document.createElement(tag);
    av.className = "efmfl-person__avatar";
    if(p.link){ av.setAttribute("href", safeUrl(p.link)); av.setAttribute("aria-label", p.name); }
    if(p.photo){
      var img = document.createElement("img");
      img.src = p.photo; img.alt = p.name; img.loading = "lazy";
      img.addEventListener("error", function(){
        av.textContent = "";
        var ph = document.createElement("span");
        ph.className = "efmfl-person__initials";
        ph.textContent = initials(p.name);
        av.appendChild(ph);
      });
      av.appendChild(img);
    } else {
      var ph = document.createElement("span");
      ph.className = "efmfl-person__initials";
      ph.textContent = initials(p.name);
      av.appendChild(ph);
    }
    return av;
  }
  function personEl(p){
    var wrap = document.createElement("div");
    wrap.className = "efmfl-person";
    var av = avatarEl(p);
    wrap.appendChild(av);
    var body = document.createElement("div");
    body.className = "efmfl-person__body";
    var hasModal = !!((p.bio && p.bio.trim()) || (p.affiliations && p.affiliations.trim()) || (p.website && p.website.trim()));
    var name = document.createElement(p.link || hasModal ? "a" : "div");
    name.className = "efmfl-person__name";
    name.textContent = p.name;
    if(p.link) name.setAttribute("href", safeUrl(p.link));
    else if(hasModal) name.setAttribute("href", "#");
    body.appendChild(name);
    if(p.role){
      var role = document.createElement("div");
      role.className = "efmfl-person__role";
      role.textContent = p.role;
      body.appendChild(role);
    }
    wrap.appendChild(body);
    // bio / affiliations / website turn the name + photo into a popup trigger
    // (still left-clickable through to the page via the href for new-tab / no-JS).
    if(hasModal){
      name.setAttribute("data-efmfl-bio","1");
      av.setAttribute("data-efmfl-bio","1");
      var open = function(e){ e.preventDefault(); openModal(p); };
      name.addEventListener("click", open);
      av.addEventListener("click", open);
    }
    return wrap;
  }

  /* Force our container + any faded ancestors visible (Duda's scroll-reveal
     entrance animation can otherwise leave JS-rendered content stuck invisible
     until a hover repaints it). */
  function defuseAnimations(){
    for(var el = host; el && el !== document.body; el = el.parentElement){
      try{
        var cs = getComputedStyle(el);
        if(parseFloat(cs.opacity) < 1) el.style.setProperty("opacity","1","important");
        if(cs.visibility === "hidden") el.style.setProperty("visibility","visible","important");
        if(el.classList && el.classList.contains("animated")) el.classList.add("revealed");
      }catch(e){}
    }
  }
  /* Keep the Duda widget box matched to our responsive content height, so the
     desktop <-> tablet <-> mobile reflow (and the tab switch) never leaves a
     fixed-height gap and never CLIPS the lower part of the grid. */
  function autoHeight(){
    var node = host;
    if(!node) return;
    for(var el = node.parentElement; el && el !== document.body; el = el.parentElement){
      try{
        var cs = getComputedStyle(el);
        var hidesOverflow = cs.overflowY === "hidden" || cs.overflowY === "clip" || cs.overflow === "hidden";
        var clipper = el.scrollHeight > el.clientHeight + 2 && hidesOverflow;
        var pinned  = el.style && /px\s*$/.test(el.style.height || "");
        if(clipper || pinned){
          el.style.setProperty("height","auto","important");
          el.style.setProperty("max-height","none","important");
          el.style.setProperty("min-height","0","important");
        }
      }catch(e){}
    }
    try{
      var f = window.frameElement;   // only when Duda embedded us in a same-origin iframe
      if(f){ var h = Math.ceil(node.getBoundingClientRect().height) + 8;
        if(parseInt(f.style.height,10) !== h){ f.style.height = h + "px"; f.style.minHeight = h + "px"; } }
    }catch(e){}
  }
  var _wired = false;
  function syncBox(){ defuseAnimations(); autoHeight(); }
  function wireBox(){
    if(_wired) return; _wired = true;
    window.addEventListener("resize", syncBox);
    if(window.ResizeObserver){ try{ new ResizeObserver(syncBox).observe(host); }catch(e){} }
    var n = 0, iv = setInterval(function(){ syncBox(); if(++n >= 16) clearInterval(iv); }, 250);
  }

  /* ---- render one tab (flat grid, name + headshot, bio on click) ---- */
  function renderGrid(key, people){
    var root = roots[key], statusEl = statuses[key];
    if(!root) return;
    root.textContent = "";
    if(!people.length){ setStatus(statusEl, EMPTY_MSG[key] || "Nobody to display yet."); return; }
    setStatus(statusEl, "");
    var sec = document.createElement("section");
    sec.className = "efmfl-section";
    var grid = document.createElement("div");
    grid.className = "efmfl-grid";
    people.forEach(function(p){ grid.appendChild(personEl(p)); });
    sec.appendChild(grid);
    root.appendChild(sec);
  }
  function peopleFor(key, people){
    return people.filter(function(p){
      var conducting = isConducting(p.section);
      return key === "conducting" ? conducting : !conducting;
    });
  }
  function applyData(people){
    allPeople = people || [];
    TABS.forEach(function(t){ renderGrid(t.key, peopleFor(t.key, allPeople)); });
    syncBox();
  }

  /* ---- tabs ---- */
  var buttons = {}, active = null;
  function buildTabs(){
    tabsBar.textContent = "";
    TABS.forEach(function(t){
      var b = document.createElement("button");
      b.type = "button"; b.className = "efmfl-tab"; b.id = "efmfl-tab-" + t.key;
      b.textContent = t.label;
      b.setAttribute("role","tab"); b.setAttribute("aria-selected","false");
      b.setAttribute("aria-controls","efmfl-panel-" + t.key);
      b.addEventListener("click", function(){ activate(t.key, true); });
      b.addEventListener("keydown", onTabKey);
      tabsBar.appendChild(b); buttons[t.key] = b;
    });
  }
  function onTabKey(e){
    var keys = TABS.map(function(t){ return t.key; });
    var i = keys.indexOf(active);
    if(e.key === "ArrowRight" || e.key === "ArrowDown"){ e.preventDefault(); activate(keys[(i+1)%keys.length], true); buttons[active].focus(); }
    else if(e.key === "ArrowLeft" || e.key === "ArrowUp"){ e.preventDefault(); activate(keys[(i-1+keys.length)%keys.length], true); buttons[active].focus(); }
    else if(e.key === "Home"){ e.preventDefault(); activate(keys[0], true); buttons[active].focus(); }
    else if(e.key === "End"){ e.preventDefault(); activate(keys[keys.length-1], true); buttons[active].focus(); }
  }
  function activate(key, hash){
    if(!buttons[key]) key = DEFAULT_TAB;
    active = key;
    TABS.forEach(function(t){
      var on = t.key === key;
      if(buttons[t.key]){ buttons[t.key].setAttribute("aria-selected", on ? "true" : "false"); buttons[t.key].tabIndex = on ? 0 : -1; }
      if(panels[t.key]) panels[t.key].hidden = !on;
    });
    if(hash){ try{ history.replaceState(null,"","#"+key); }catch(e){} }
    syncBox();
  }

  /* ---- fetch: blob-first, then the Fellows sheet direct, then FALLBACK_DATA ---- */
  function urlOk(u){ return u && !/PASTE|YOUR_|^\s*$/.test(u); }
  function b64ToUtf8(b64){
    var bin = atob(b64), bytes = new Uint8Array(bin.length), i;
    for(i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    if(window.TextDecoder) return new window.TextDecoder("utf-8").decode(bytes);
    return decodeURIComponent(escape(bin));
  }
  function readBlob(){
    var url = "https://docs.google.com/spreadsheets/d/" + FACULTY_BLOB_ID +
              "/gviz/tq?tqx=out:csv&sheet=" + encodeURIComponent(BLOB_TAB);
    return fetch(url, { cache:"no-store" }).then(function(r){
      if(!r.ok) throw new Error("HTTP " + r.status);
      return r.text();
    }).then(function(csv){
      var cells = parseCSV(csv).map(function(row){ return row[0]; })
        .filter(function(c){ return c && c.indexOf("EFM-FACULTY-BLOB") !== 0; });
      return JSON.parse(b64ToUtf8(cells.join("")));
    });
  }
  function rowsFromBlob(blob){
    var wb = blob && blob.workbooks && blob.workbooks[BLOB_WORKBOOK];
    var rows = wb && wb[BLOB_SHEET];
    return (rows && rows.length > 1) ? rows : null;
  }
  function loadDirect(){
    var urls = [SHEET_CSV_URL].concat(SHEET_CSV_FALLBACKS || []).filter(urlOk);
    return new Promise(function(resolve, reject){
      (function tryNext(i){
        if(i >= urls.length){ reject(0); return; }
        fetch(urls[i], { cache:"no-store" })
          .then(function(r){ if(!r.ok) throw 0; return r.text(); })
          .then(function(t){ var rows = parseCSV(t); if(rows.length < 2) throw 0; resolve(rows); })
          .catch(function(){ tryNext(i + 1); });
      })(0);
    });
  }
  function loadRows(){
    if(BLOB_ENABLED){
      return readBlob().then(function(blob){
        var r = rowsFromBlob(blob);
        if(r) return r;
        throw 0;
      }).catch(function(){ return loadDirect(); });
    }
    return loadDirect();
  }

  var lastRowsStr = null, _built = false, _autoOn = false;
  function start(){
    setAllStatus("Loading…");
    loadRows().then(function(rows){
      var data = rowsToData(rows);
      if(!data.length) throw 0;
      try{ lastRowsStr = JSON.stringify(rows); }catch(e){ lastRowsStr = null; }
      applyData(data);
      startAutoRefresh();
    }).catch(function(){ applyData(FALLBACK_DATA); });
  }

  /* ---- live auto-refresh (blob only) ------------------------------------
     While the tab is visible, re-read the blob every couple of minutes and, only
     if it actually changed, re-render both grids in place (the active tab and
     scroll position are untouched). Skips while a modal is open. */
  function refresh(){
    if(!BLOB_ENABLED || !_built || document.hidden) return;
    if(modal && !modal.hidden) return;
    readBlob().then(function(blob){
      var rows = rowsFromBlob(blob); if(!rows) return;
      var s; try{ s = JSON.stringify(rows); }catch(e){ return; }
      if(s === lastRowsStr) return;
      var data = rowsToData(rows); if(!data.length) return;
      lastRowsStr = s;
      applyData(data);
    }).catch(function(){});
  }
  function startAutoRefresh(){
    _built = true;
    if(_autoOn || !BLOB_ENABLED) return; _autoOn = true;
    setInterval(refresh, 120000);   // every 2 minutes, visible tab only
    document.addEventListener("visibilitychange", function(){ if(!document.hidden) refresh(); });
  }

  function setup(){
    if(MODULE_TITLE && titleEl){ titleEl.textContent = MODULE_TITLE; titleEl.hidden = false; }
    buildTabs();
    var fromHash = (location.hash || "").replace("#","").toLowerCase();
    activate(buttons[fromHash] ? fromHash : DEFAULT_TAB, false);
    window.addEventListener("hashchange", function(){
      var k = (location.hash || "").replace("#","").toLowerCase();
      if(buttons[k]) activate(k, false);
    });
    wireBox();
  }
  function boot(){
    host = document.getElementById("efm-fellows");
    if(!host) return;   // widget not on this page -> no-op (paste order irrelevant)
    titleEl = host.querySelector("[data-efmfl-title]");
    tabsBar = host.querySelector("[data-efmfl-tabs]");
    TABS.forEach(function(t){
      panels[t.key]   = host.querySelector('[data-efmfl-panel="' + t.key + '"]');
      roots[t.key]    = host.querySelector('[data-efmfl-root="' + t.key + '"]');
      statuses[t.key] = host.querySelector('[data-efmfl-status="' + t.key + '"]');
    });
    if(!tabsBar || !roots[DEFAULT_TAB]) return;   // expected tabbed markup not present -> no-op
    setup();
    start();
  }
  if(document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
  else boot();
})();
