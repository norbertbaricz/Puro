const jobs = [
    {
        id: 'cashier',
        emoji: '🛒',
        name: 'Cashier',
        description: 'Handle checkouts and keep customers smiling.',
        apply: {
            baseSuccessRate: 0.95,
            successMessages: [
                'Management loved your friendly energy. Welcome behind the counter!'
            ],
            failureMessages: [
                'They need someone a bit quicker on the register. Practice and retry soon!'
            ]
        },
        work: {
            cooldownSeconds: 55,
            payRange: { min: 30, max: 70 },
            bonusChance: 0.18,
            bonusMultiplier: { min: 1.05, max: 1.2 },
            failureChance: 0.05,
            failurePenaltyRange: { min: 2, max: 6 },
            successMessages: [
                'Every barcode scanned flawlessly and customers left grinning.',
                'You handled a rush-hour surge without breaking a sweat.',
                'Exact change wizard! The line never stopped moving.',
                'Your friendly banter earned a stack of compliments cards.'
            ],
            bonusMessages: [
                'A regular tipped extra for your quick service.',
                'The shift lead slipped you a bonus for covering breaks.',
                'Management praised your spotless lane and handed over a gift card.'
            ],
            failureMessages: [
                'A carton of eggs slipped; cleanup time ate your evening.',
                'A price-check fiasco slowed everything down.',
                'A miscounted till meant you stayed late balancing the drawer.'
            ]
        }
    },
    {
        id: 'barista',
        emoji: '☕',
        name: 'Barista',
        description: 'Serve handcrafted drinks and keep the cafe buzzing.',
        apply: {
            baseSuccessRate: 0.9,
            successMessages: [
                'The manager loved your latte art portfolio. Welcome aboard!'
            ],
            failureMessages: [
                'The hiring manager said they will keep your CV on file. Maybe polish your foam art?'
            ]
        },
        work: {
            cooldownSeconds: 70,
            payRange: { min: 45, max: 95 },
            bonusChance: 0.24,
            bonusMultiplier: { min: 1.1, max: 1.35 },
            failureChance: 0.08,
            failurePenaltyRange: { min: 5, max: 12 },
            successMessages: [
                'Customers could not get enough of your caramel macchiatos.',
                'A rush hour was no match for your coffee magic.',
                'Your playlist and pour-overs boosted everyone\'s mood.',
                'You nailed the latte art workshop and the crowd applauded.'
            ],
            bonusMessages: [
                'A regular tipped big for remembering their custom order.',
                'The cafe owner shared the tip jar after a stellar shift.',
                'An influencer shared your drink; sales spiked and so did tips.'
            ],
            failureMessages: [
                'You spilled a whole tray of drinks and had to comp them.',
                'The espresso machine broke mid-shift; no tips today.',
                'An over-roasted batch of beans meant tossing expensive stock.'
            ]
        }
    },
    {
        id: 'librarian',
        emoji: '📚',
        name: 'Librarian',
        description: 'Catalog books, help patrons, and keep things whisper-quiet.',
        apply: {
            baseSuccessRate: 0.88,
            successMessages: [
                'Your organizational skills impressed the head librarian. Welcome!'
            ],
            failureMessages: [
                'They asked for more cataloging experience. Volunteer and try again soon.'
            ]
        },
        work: {
            cooldownSeconds: 65,
            payRange: { min: 55, max: 115 },
            bonusChance: 0.22,
            bonusMultiplier: { min: 1.08, max: 1.3 },
            failureChance: 0.06,
            failurePenaltyRange: { min: 4, max: 10 },
            successMessages: [
                'You guided dozens of readers to their perfect book.',
                'A massive re-shelving project finished ahead of schedule.',
                'Story hour was a hit thanks to your dramatic reading.',
                'You restored a rare tome and earned librarian legend status.'
            ],
            bonusMessages: [
                'A patron donated after you helped them research a project.',
                'The director awarded you for digitizing a rare collection.',
                'A university paid for access to your meticulously organized archive.'
            ],
            failureMessages: [
                'A misfiled stack meant overtime re-shelving.',
                'You spilled tea on returned books and paid servicing fees.',
                'The microfilm reader jammed and you replaced parts out of pocket.'
            ]
        }
    },
    {
        id: 'courier',
        emoji: '🚲',
        name: 'Courier',
        description: 'Zip around town delivering urgent parcels.',
        apply: {
            baseSuccessRate: 0.78,
            successMessages: [
                'Your navigation skills impressed dispatch. You got the job!'
            ],
            failureMessages: [
                'They were hoping for faster delivery averages. Train a bit and retry!'
            ]
        },
        work: {
            cooldownSeconds: 90,
            payRange: { min: 70, max: 150 },
            bonusChance: 0.2,
            bonusMultiplier: { min: 1.15, max: 1.5 },
            failureChance: 0.12,
            failurePenaltyRange: { min: 10, max: 20 },
            successMessages: [
                'Every package arrived ahead of schedule — clients cheered!',
                'You discovered a shortcut and saved the day.',
                'Zero traffic and perfect timing. A textbook delivery run.'
            ],
            bonusMessages: [
                'A grateful client tipped extra for urgent handling.',
                'Dispatch rewarded you for taking a double route.'
            ],
            failureMessages: [
                'A flat tire forced you to cancel half the route.',
                'Traffic jams ruined the delivery schedule.'
            ]
        }
    },
    {
        id: 'mechanic',
        emoji: '🔧',
        name: 'Mechanic',
        description: 'Repair vehicles, keep engines humming, and rescue breakdowns.',
        apply: {
            baseSuccessRate: 0.68,
            successMessages: [
                'Your diagnostic test wowed the garage foreman. Grab a wrench!'
            ],
            failureMessages: [
                'They want more certifications on file. Ace another course and return.'
            ]
        },
        work: {
            cooldownSeconds: 95,
            payRange: { min: 95, max: 185 },
            bonusChance: 0.2,
            bonusMultiplier: { min: 1.1, max: 1.45 },
            failureChance: 0.14,
            failurePenaltyRange: { min: 12, max: 24 },
            successMessages: [
                'You rebuilt an engine in record time and satisfied a fleet client.',
                'Every car left the shop purring like new.',
                'Your quick roadside rescue saved someone\'s vacation.'
            ],
            bonusMessages: [
                'The garage owner paid extra for a tough repair.',
                'A grateful driver tipped you for the life-saving fix.'
            ],
            failureMessages: [
                'A stripped bolt meant replacing extra parts from your pocket.',
                'A comeback repair forced you to refund some labour.'
            ]
        }
    },
    {
        id: 'chef',
        emoji: '🍳',
        name: 'Sous Chef',
        description: 'Prep dishes, run the line, and plate everything to perfection.',
        apply: {
            baseSuccessRate: 0.6,
            successMessages: [
                'Your knife skills dazzled the head chef. Apron up!'
            ],
            failureMessages: [
                'They need more restaurant experience. Stage for a night and reapply.'
            ]
        },
        work: {
            cooldownSeconds: 85,
            payRange: { min: 85, max: 175 },
            bonusChance: 0.26,
            bonusMultiplier: { min: 1.15, max: 1.45 },
            failureChance: 0.12,
            failurePenaltyRange: { min: 8, max: 18 },
            successMessages: [
                'You kept the tickets flowing and every dish came out hot.',
                'Tonight\'s specials sold out thanks to your plating finesse.',
                'Zero remakes and rave reviews—service was silky smooth.'
            ],
            bonusMessages: [
                'The chef shared tips from the VIP table.',
                'A food critic praised your dish, and management added a bonus.'
            ],
            failureMessages: [
                'A sauce split mid-service and slowed the whole line.',
                'Burnt garnish meant remaking plates at your expense.'
            ]
        }
    },
    {
        id: 'security_officer',
        emoji: '🛡️',
        name: 'Security Officer',
        description: 'Keep venues safe, handle incidents, and maintain order.',
        apply: {
            baseSuccessRate: 0.62,
            successMessages: [
                'Your calm presence impressed the security chief. Badge up!'
            ],
            failureMessages: [
                'They need more situational training logs. Practice and try again.'
            ]
        },
        work: {
            cooldownSeconds: 80,
            payRange: { min: 90, max: 165 },
            bonusChance: 0.2,
            bonusMultiplier: { min: 1.1, max: 1.4 },
            failureChance: 0.14,
            failurePenaltyRange: { min: 10, max: 22 },
            successMessages: [
                'You diffused a heated argument before it escalated.',
                'Night patrol ran smooth and no alarms were triggered.',
                'You assisted guests and got compliments for your professionalism.'
            ],
            bonusMessages: [
                'Management rewarded you for catching a suspicious intruder.',
                'The venue tipped extra after your impeccable crowd control.'
            ],
            failureMessages: [
                'A damaged barricade came out of your paycheck.',
                'You had to cover medical costs after a scuffle.'
            ]
        }
    },
    {
        id: 'event_planner',
        emoji: '🎉',
        name: 'Event Planner',
        description: 'Organize unforgettable gatherings and keep clients delighted.',
        apply: {
            baseSuccessRate: 0.5,
            successMessages: [
                'Your mood board wowed the agency. You\'re leading the next event!'
            ],
            failureMessages: [
                'They want a stronger portfolio. Coordinate a community event then reapply.'
            ]
        },
        work: {
            cooldownSeconds: 110,
            payRange: { min: 140, max: 280 },
            bonusChance: 0.28,
            bonusMultiplier: { min: 1.2, max: 1.6 },
            failureChance: 0.16,
            failurePenaltyRange: { min: 10, max: 25 },
            successMessages: [
                'Every vendor showed up on time and the client cheered.',
                'You flipped a rehearsal disaster into a flawless finale.',
                'The venue manager added you to their preferred planner list.'
            ],
            bonusMessages: [
                'A grateful couple handed you a thick envelope of tips.',
                'The agency gave you a bonus for upselling premium décor.'
            ],
            failureMessages: [
                'A missing caterer meant compensating guests out of pocket.',
                'The DJ no-showed, forcing you to refund part of the fee.'
            ]
        }
    },
    {
        id: 'photographer',
        emoji: '📸',
        name: 'Photographer',
        description: 'Capture moments, edit masterpieces, and impress clients.',
        apply: {
            baseSuccessRate: 0.48,
            successMessages: [
                'Your portfolio stunned the studio director. Lights, camera, action!'
            ],
            failureMessages: [
                'They want more lighting setups in your book. Shoot a few and reapply.'
            ]
        },
        work: {
            cooldownSeconds: 100,
            payRange: { min: 125, max: 260 },
            bonusChance: 0.27,
            bonusMultiplier: { min: 1.15, max: 1.7 },
            failureChance: 0.18,
            failurePenaltyRange: { min: 12, max: 26 },
            successMessages: [
                'Every shot was perfectly framed and the client raved.',
                'You salvaged a rainy shoot and turned it into art.',
                'Your edits went viral and bookings exploded.'
            ],
            bonusMessages: [
                'The client bought extended usage rights for extra cash.',
                'A surprise tip came from delighted newlyweds.'
            ],
            failureMessages: [
                'A corrupted SD card forced you to pay for recovery.',
                'You rented extra gear after yours failed mid-session.'
            ]
        }
    },
    {
        id: 'researcher',
        emoji: '🔬',
        name: 'Research Analyst',
        description: 'Dive into data, run experiments, and publish compelling results.',
        apply: {
            baseSuccessRate: 0.4,
            successMessages: [
                'Your case study blew the review panel away. Welcome to the lab!'
            ],
            failureMessages: [
                'They want more peer-reviewed work. Gather more data and return.'
            ]
        },
        work: {
            cooldownSeconds: 130,
            payRange: { min: 190, max: 340 },
            bonusChance: 0.24,
            bonusMultiplier: { min: 1.25, max: 1.7 },
            failureChance: 0.2,
            failurePenaltyRange: { min: 15, max: 32 },
            successMessages: [
                'Your findings unlocked a new initiative and secured funding.',
                'The team praised your airtight methodology and insights.',
                'Your report made the front page of the internal newsletter.'
            ],
            bonusMessages: [
                'A grant bonus landed in your account after a breakthrough.',
                'The client paid extra for your rapid turnaround.'
            ],
            failureMessages: [
                'A contaminated sample forced you to rerun everything.',
                'Your dataset corrupted, costing you precious time and resources.'
            ]
        }
    },
    {
        id: 'paramedic',
        emoji: '🚑',
        name: 'Paramedic',
        description: 'Respond to emergencies and keep patients stable en route.',
        apply: {
            baseSuccessRate: 0.32,
            successMessages: [
                'Your calm under pressure earned you a slot on the ambulance crew.'
            ],
            failureMessages: [
                'They require more certification hours. Train harder and reapply.'
            ]
        },
        work: {
            cooldownSeconds: 160,
            payRange: { min: 220, max: 400 },
            bonusChance: 0.22,
            bonusMultiplier: { min: 1.3, max: 1.85 },
            failureChance: 0.25,
            failurePenaltyRange: { min: 25, max: 45 },
            successMessages: [
                'You stabilized every patient and arrived ahead of ETA.',
                'A complex call ended with grateful hugs from a family.',
                'You coordinated flawlessly with hospital staff and saved time.'
            ],
            bonusMessages: [
                'A grateful family donated to your crew and shared the tip.',
                'City hall issued a bonus for exemplary service during a disaster.'
            ],
            failureMessages: [
                'A rough ride damaged equipment you had to help replace.',
                'You mislaid meds and paid for expedited restocking.'
            ]
        }
    },
    {
        id: 'musician',
        emoji: '🎸',
        name: 'Touring Musician',
        description: 'Perform on stage and hype the crowd, rain or shine.',
        apply: {
            baseSuccessRate: 0.28,
            successMessages: [
                'Your audition solo electrified the producer. You\'re on the tour!'
            ],
            failureMessages: [
                'They want tighter timing. Keep rehearsing and try again.'
            ]
        },
        work: {
            cooldownSeconds: 120,
            payRange: { min: 110, max: 280 },
            bonusChance: 0.3,
            bonusMultiplier: { min: 1.2, max: 1.9 },
            failureChance: 0.22,
            failurePenaltyRange: { min: 12, max: 28 },
            successMessages: [
                'The crowd sang every lyric with you—instant encores!',
                'Merch sales spiked after your standout performance.',
                'Your solo trended on social media overnight.'
            ],
            bonusMessages: [
                'The promoter paid extra after you saved the show.',
                'A surprise sponsor tipped the band for a stellar gig.'
            ],
            failureMessages: [
                'A broken string mid-song meant refunding some fans.',
                'Technical issues forced you to pay for replacement gear.'
            ]
        }
    },
    {
        id: 'investigator',
        emoji: '🕵️',
        name: 'Investigator',
        description: 'Piece together clues for high-stakes cases.',
        apply: {
            baseSuccessRate: 0.22,
            successMessages: [
                'Your keen eye for detail landed you the assignment.'
            ],
            failureMessages: [
                'They need more experienced sleuths for this case. Study and reapply.'
            ]
        },
        work: {
            cooldownSeconds: 150,
            payRange: { min: 180, max: 360 },
            bonusChance: 0.22,
            bonusMultiplier: { min: 1.3, max: 1.9 },
            failureChance: 0.24,
            failurePenaltyRange: { min: 20, max: 45 },
            successMessages: [
                'You cracked the case wide open and saved the day.',
                'Your deductions exposed the culprit before they fled.',
                'Clients were stunned by how fast you delivered answers.'
            ],
            bonusMessages: [
                'The agency paid a premium for classified intel.',
                'You uncovered extra evidence and received a sizable reward.'
            ],
            failureMessages: [
                'A lead went cold and the client withheld payment.',
                'You spent hours chasing a red herring — expenses only.'
            ]
        }
    },
    {
        id: 'cyber_security',
        emoji: '🖥️',
        name: 'Cyber Security Specialist',
        description: 'Harden systems, stop breaches, and hunt down intruders.',
        apply: {
            baseSuccessRate: 0.16,
            successMessages: [
                'Your penetration test report impressed the CISO. Suit up!'
            ],
            failureMessages: [
                'They need more red-team experience. Train up and reapply.'
            ]
        },
        work: {
            cooldownSeconds: 140,
            payRange: { min: 210, max: 380 },
            bonusChance: 0.25,
            bonusMultiplier: { min: 1.2, max: 1.8 },
            failureChance: 0.22,
            failurePenaltyRange: { min: 18, max: 38 },
            successMessages: [
                'You patched a zero-day before attackers could blink.',
                'Your incident response contained a breach in minutes.',
                'Executives applauded your detailed threat report.'
            ],
            bonusMessages: [
                'The client paid extra for a 24-hour monitoring sprint.',
                'Bug bounty winnings hit your account after a huge disclosure.'
            ],
            failureMessages: [
                'A missed alert meant paying for identity protection services.',
                'You reimbursed overtime after misconfiguring a firewall.'
            ]
        }
    },
    {
        id: 'pilot',
        emoji: '✈️',
        name: 'Aviation Pilot',
        description: 'Fly high-value routes and keep passengers safe across the skies.',
        apply: {
            baseSuccessRate: 0.08,
            successMessages: [
                'Your simulator scores blew the chief pilot away. Welcome aboard!'
            ],
            failureMessages: [
                'They want more flight hours logged. Rack them up and reapply.'
            ]
        },
        work: {
            cooldownSeconds: 180,
            payRange: { min: 360, max: 620 },
            bonusChance: 0.24,
            bonusMultiplier: { min: 1.35, max: 2.0 },
            failureChance: 0.28,
            failurePenaltyRange: { min: 40, max: 70 },
            successMessages: [
                'Smooth skies and perfect landings earned a standing ovation.',
                'You navigated turbulence flawlessly and passengers applauded.',
                'A VIP passenger praised you to the airline CEO.'
            ],
            bonusMessages: [
                'First class pooled a generous tip after a stellar flight.',
                'The airline added a safety bonus for your impeccable record.'
            ],
            failureMessages: [
                'A diverted route cost you extra fuel fees.',
                'Maintenance delays meant compensating passengers.'
            ]
        }
    },
    {
        id: 'streamer',
        emoji: '📺',
        name: 'Content Streamer',
        description: 'Go live, entertain the pack, and grow your digital audience.',
        apply: {
            baseSuccessRate: 0.12,
            successMessages: [
                'Your pilot stream went viral. Sponsorships are lined up!'
            ],
            failureMessages: [
                'They want more consistent content. Stream a bit more and retry.'
            ]
        },
        work: {
            cooldownSeconds: 90,
            payRange: { min: 40, max: 320 },
            bonusChance: 0.35,
            bonusMultiplier: { min: 1.2, max: 2.2 },
            failureChance: 0.2,
            failurePenaltyRange: { min: 10, max: 30 },
            successMessages: [
                'Chat exploded with subs and donations all night long.',
                'A collab raid doubled your follower count.',
                'You debuted a segment that fans can\'t stop sharing.'
            ],
            bonusMessages: [
                'A sponsor dropped a hefty bonus mid-stream.',
                'A community whale gifted memberships for everyone.'
            ],
            failureMessages: [
                'ISP issues cut the stream short and drained refunds.',
                'A DMCA strike forced you to pay for new assets.'
            ]
        }
    }
];

function getAllJobs() {
    return jobs;
}

function getJobById(id) {
    return jobs.find(job => job.id === id) || null;
}

function formatPayRange(job) {
    const { min, max } = job.work.payRange;
    return `$${min.toLocaleString()} - $${max.toLocaleString()}`;
}

module.exports = {
    jobs,
    getAllJobs,
    getJobById,
    formatPayRange
};
