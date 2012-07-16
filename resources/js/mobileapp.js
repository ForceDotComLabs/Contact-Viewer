/*
 * Copyright (c) 2011, salesforce.com <http://salesforce.com> , inc.
 * Author: Akhilesh Gupta
 * All rights reserved.
 * 
 * Redistribution and use in source and binary forms, with or without modification, are permitted provided 
 * that the following conditions are met:
 * 
 *    Redistributions of source code must retain the above copyright notice, this list of conditions and the 
 *    following disclaimer.
 *  
 *    Redistributions in binary form must reproduce the above copyright notice, this list of conditions and 
 *    the following disclaimer in the documentation and/or other materials provided with the distribution. 
 *    
 *    Neither the name of salesforce.com <http://salesforce.com> , inc. nor the names of its contributors may be used to endorse or 
 *    promote products derived from this software without specific prior written permission.
 *  
 * THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS "AS IS" AND ANY EXPRESS OR IMPLIED 
 * WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE IMPLIED WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A 
 * PARTICULAR PURPOSE ARE DISCLAIMED. IN NO EVENT SHALL THE COPYRIGHT OWNER OR CONTRIBUTORS BE LIABLE FOR 
 * ANY DIRECT, INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY, OR CONSEQUENTIAL DAMAGES (INCLUDING, BUT NOT LIMITED 
 * TO, PROCUREMENT OF SUBSTITUTE GOODS OR SERVICES; LOSS OF USE, DATA, OR PROFITS; OR BUSINESS INTERRUPTION) 
 * HOWEVER CAUSED AND ON ANY THEORY OF LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY, OR TORT (INCLUDING 
 * NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF THE USE OF THIS SOFTWARE, EVEN IF ADVISED OF THE 
 * POSSIBILITY OF SUCH DAMAGE.
 */

var login_redirect_storage_key = 'SFDC-LOGIN-REDIRECT';

var infopagescroll;
var hasRecordTypes = false, hasChatterEnabled = false;
var contactLabel = 'Contact', contactPluralLabel = 'Contacts';

var listView, splitView, sobjectModel;

function initiateInfoScroller() {
    if (infopagescroll === undefined) {
        infopagescroll = createScroller('infoscroller');
        $j(window).orientationChange(initiateInfoScroller);
    } else {
        infopagescroll.refresh();
    }
}

function destroyInfoScroller() {
    if (infopagescroll) {
        $j(window).unbindOrientationChange(initiateInfoScroller);
        infopagescroll.destroy();
        infopagescroll = undefined;
    }
}


function sessionCallback() {
    
    $j('#loggedin').css('display', 'block');
    
    addClickListeners();

    var describeCallback, selectedContactId;    
    var ind = $j('#loggedin').showActivityInd('Loading...');
        
    var last_visit_loc = StorageManager.getLocalValue(last_visited_loc_storage_key);
    if (last_visit_loc && last_visit_loc.split('/').length == 2) {
        
        last_visit_loc = last_visit_loc.split('/');
        selectedContactId = last_visit_loc[0];
        
        describeCallback = function(success) { 
            if (success) {
                ind.hide();
                showContact(selectedContactId);
            }
        }
    }
    
    fetchContactDescribe(describeCallback);

    sobjectModel = {
        setRecords : function(recs) {
            this.records = recs;
            this.recordIds = [];
            for (i in recs) this.recordIds.push(recs[i].Id);
        }
    };
    
    splitView = new sforce.SplitView();
    listView = new sforce.ListView({selectedContactId: selectedContactId, onListSelect: getContacts, onSearch: searchContacts, onItemSelect: showContact});
    
    splitView.addOrientationChangeCallback(
        function() { listView.refreshScroller(); }
    );
    
    getContacts('recent', ind.hide);
    
    // Add the add to home screen scripts if needed
    if (typeof window.addToHomeLaunch == 'function') window.addToHomeLaunch();
}

function switchToDetail(callback) {
    if (useAnimations) {
        $j('#listpage').changePage('#detailpage', false, callback);
    } else {
        $j('#listpage').hide();
        $j('#detailpage').show().css('visibility', '');
        if (typeof callback == 'function') callback();
    }
}

function addClickListeners(searchContacts, displayList) {
    
    $j('#listpage #header #gear').off().enableTap().click(
        function(e) {
            e.preventDefault();
            SettingsManager.show();
        });
}

function showContact(contactId, onComplete) {

    // Hide the details and show the empty panel after hide operation completes
    $j('#detailpage #detail').hide();
    $j('#detailpage .header>span').empty();
    switchToDetail();

    var ind = $j('#loggedin').showActivityInd('Loading...');
    switchDetailSection('info', [contactId], function(success) { 
        if (success) $j('#detailpage #detail').show();
        $j('#detailpage .header #left').off().enableTap().click(function(e) {
            var onSlideBack = function() {
                $j('#detailpage').css('visibility', 'hidden');
                listView.resetSelectedContact();
            }
            $j('#detailpage .header #left').off();
            if (useAnimations) {
                $j('#detailpage').changePage('#listpage', true, onSlideBack); 
            } else {
                $j('#detailpage').hide();
                $j('#listpage').show().css('visibility', '');
                onSlideBack();
            }
            updateLastVisitLoc();
        });
        ind.hide();
        if (typeof onComplete == 'function') onComplete();
    });
    updateLastVisitLoc(contactId + '/' + 'info');
}

function displayContactSummary(contact) {
    $j('#Id').val(contact.Id);
    var fieldInfo = getFieldDescribe();
    var detail = $j('#detailpage #detail');
    detail.find('#summary #photo_div>div').html(contact.Name)
    .append('<br/>').append((contact.Title) ? formatStr(contact.Title) + ', ' : '')
    .append(formatStr(contact.Department) || '&nbsp;').append('<br/>')
    .append(contact.Account ? formatStr(contact.Account.Name) : '&nbsp;');

    if (contact.Phone) {
        var phone = cleanupPhone(contact.Phone);
        detail.find('#call_contact #skype').attr('href', 'skype:' + phone + '?call').show();
        if ((/ipad|iphone/gi).test(navigator.platform)) 
            detail.find('#call_contact #facetime').attr('href', 'facetime://' + phone).show();
        else detail.find('#call_contact #facetime').hide();
    } else {
        detail.find('#call_contact #skype').attr('href', '#').hide();
        detail.find('#call_contact #facetime').attr('href', '#').hide();
    }
    
    if (contact.Email) {
        detail.find('#call_contact #email').attr('href', 'mailto:' + contact.Email).show();
    } else {
        detail.find('#call_contact #email').attr('href', '#').hide();
    }
}

function displayContactDetails(contact) {
    var fieldInfo = getFieldDescribe();
    var info = $j('#detailpage #detail #info');

    if (fieldInfo.Phone) {
        info.find('#Phone').show();
        info.find('#Phone.rowLabel span').text(fieldInfo.Phone.label);
        info.find('#Phone.rowValue span').html((contact.Phone) ? '<a href="tel:' + formatStr(cleanupPhone(contact.Phone)) + '" style="text-decoration:none;">' + formatStr(contact.Phone, 30) + '</a>' : '&nbsp;');
    } else {
        info.find('#Phone').hide();
    }
    if (fieldInfo.MobilePhone) {
        info.find('#Mobile').show();
        info.find('#Mobile.rowLabel span').text(fieldInfo.MobilePhone.label);
        info.find('#Mobile.rowValue span').html((contact.MobilePhone) ? '<a href="tel:' + formatStr(cleanupPhone(contact.MobilePhone)) + '">' + formatStr(contact.MobilePhone, 30) + '</a>' : '&nbsp;');
    } else {
        info.find('#Mobile').hide();
    }
    if (fieldInfo.Email) {
        info.find('#Email').show();
        info.find('#Email.rowLabel span').text(fieldInfo.Email.label);
        info.find('#Email.rowValue span').html((contact.Email) ? '<a href="mailto:' + contact.Email + '" style="text-decoration:none;">' + formatStr(contact.Email, 50) + '</a>' : '&nbsp;');   
    } else {
        info.find('#Email').hide();
    }

    if (fieldInfo.MailingStreet != undefined) {
        var add = formatAddress(contact);
        info.find('#Address').show();
        info.find('#Address.rowLabel span').text('Mailing Address');
        if (add.length > 0 ) {
            add = '<a href="https://maps.google.com/maps?q=' + encodeURI(add.replace(/\n/g, ', ')) + '">' +
                  add.replace(/\n/g, '<br/>') + '</a>';
            info.find('#Address.rowValue span').html(add);
        } else {
            info.find('#Address.rowValue span').empty();
        }
    } else {
        info.find('#Address').hide();
    }
}

function renderContactInfo(contactId, callback) {
    var loadSuccess = false;
    
    var onComplete = function(jqXHR, statusText) {
        if (typeof callback == 'function') {
            setTimeout( function() { 
                //truncateLongText($j('#detailpage #detail #summary table td div')); 
                initiateInfoScroller(); infopagescroll.scrollTo(0, 0, 0); 
            }, 10);
            callback(loadSuccess);
        }
    }
    
    var fields = ['Id', 'Name', 'Account.Id', 'Account.Name', 'Department', 'Title', 'Phone', 
                  'MobilePhone', 'Email', 'MailingStreet', 'MailingCity', 'MailingState', 
                  'MailingCountry', 'MailingPostalCode', 'ReportsTo.Name'];
    if (hasRecordTypes) fields.push('RecordTypeId');
    
    var fieldInfos = getFieldDescribe();
    
    fields = fields.filter(function(fieldName) {
        fieldName = fieldName.split('.');
        return (true && fieldInfos[fieldName[0]]);
    });
    
    var info = $j('#detailpage #detail #info');
    
    ManageUserSession.getApiClient().retrieveContactViaApex(contactId, fields,
            function(rec) {
                if(rec && 'Id' in rec) {
                    $j('#detailpage .header>span').text(rec.Name);
                    displayContactSummary(rec);
                    displayContactDetails(rec);
                    loadSuccess = true;
                 } else {
                    alert(contactLabel + ' not found. Please refresh the list and try again.');
                 }
            }, 
            errorCallback, onComplete);
}

function switchDetailSection(section, contact, callback) {
    var startTime = Date.now();

    $j('#detailpage #contactInfo').show();  
    $j('#detailpage #detail>span>div').hide();
    
    var cb = function(success) { 
        LocalyticsManager.tagDetailView(section, Date.now()-startTime);
        if (typeof callback == 'function') callback(success); 
    }
    
    if (section == 'info') {
        renderContactInfo(contact[0], function(success) { 
            if(success) $j('#detailpage #detail #infoscroller').show(); 
            cb(success); 
        });
    } else {
        cb();
    }
    updateLastVisitLoc(contact[0] + '/' + section);
}
