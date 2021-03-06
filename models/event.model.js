const mongoose = require('mongoose');

mongoose.Promise = global.Promise;

const eventSchema = mongoose.Schema({
    name: { type: String },
    location: {
        city: { type: String },
        state: { type: String },
        country: { type: String }
    },
    hacknight: { type: String },
    eventType: { type: String },
    eventDescription: { type: String },
    projectId: { type: String },
    date: { type: Date },
    hours: { type: Number },
    createdDate: { type: Date, default: Date.now },
    updatedDate: { type: Date, default: Date.now },
    checkInReady: { type: Boolean, default: false },
    owner: {
        ownerId: { type: Number }
    }
});

eventSchema.methods.serialize = function() {
    return {
        id: this._id,
        name: this.name,
        location: {
            city: this.location.city,
            state: this.location.state,
            country: this.location.country
        },
        hacknight: this.hacknight,
        eventType: this.eventType,
        eventDescription: this.eventDescription,
        projectId: this.projectId,
        date: this.date,
        hours: this.hours,
        createdDate: this.createdDate,
        checkInReady: this.checkInReady,
        owner: {
            ownerId: this.owner.ownerId
        }
    };
};

const Event = mongoose.model('Event', eventSchema);

module.exports = { Event };



