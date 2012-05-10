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
 
if (window.$j === undefined) {
    $j = $.noConflict();
}

var sforce = window.sforce;

if (sforce === undefined) {
    sforce = {};
}

// Make our own startsWith utility fn
String.prototype.startsWith = function(str) {
    return (this.substr(0, str.length) === str);
}

String.prototype.endsWith = function(str) {
    return (this.substr(this.length - str.length, this.length) === str);
}

Array.prototype.last = function() {
    return this[this.length - 1];
}

function htmlEncode(value){
  return (value) ? $j('<div/>').text(value).html() : value;
}

function htmlDecode(value){
  return (value) ? $j('<div/>').html(value).text() : value;
}

function formatStr(str, length) {
    if (str) str = htmlEncode(str);
    
    if (str && length && str.length > length) {
        return str.substr(0, length-3) + '...';
    }
    return str;
}

function cleanupPhone(phoneStr) {
    if (phoneStr) {
        var phone = htmlEncode(phoneStr);
        return (phone.trim().startsWith('+') ? '+' : '') + phone.replace(/[^0-9]/g,'');
    }
    return phoneStr;
}

function formatAddress(contact) {
    var add = ((contact.MailingStreet) ? htmlEncode(contact.MailingStreet).replace(/\n/g, ', ') + '\n' : '') +
              ((contact.MailingCity) ? htmlEncode(contact.MailingCity).replace(/\n/g, ', ') + ', ' : '') + 
              ((contact.MailingState) ? htmlEncode(contact.MailingState).replace(/\n/g, ', ') + ' ' : '') + 
              ((contact.MailingPostalCode) ? htmlEncode(contact.MailingPostalCode).replace(/\n/g, ', ') + ' ' : '') + 
              ((contact.MailingCountry) ? htmlEncode(contact.MailingCountry).replace(/\n/g, '') : '');
    return add;
}

function getBaseUrl() {
    if (siteUrl.endsWith('/')) return siteUrl.substring(0, siteUrl.length-1);
    return siteUrl;
}

function getFieldDescribe() {
    return eval('(' + StorageManager.getSessionValue(contact_describe_storage_key) + ')');
}

//FIXME: Remove my usage from code.
function truncateLongText(elems) {
    return;
}

function isPortrait() {
    return (window.innerHeight > window.innerWidth);
}

var contact_describe_storage_key = 'SFDC-CONTACT-DESCRIBE';

function fetchContactDescribe(callback) {

    var onComplete = function(jqXHR, textStatus) {
        if (typeof callback == 'function')
            callback(textStatus == 'success');
    }
    
    ManageUserSession.getApiClient().describeContactViaApex( 
            function(response) {
                contactLabel = response.label || 'Contact';
                contactPluralLabel = response.labelPlural || 'Contacts';
                if(response.fields) {
                    var fields = {};
                    $j.each(response.fields,
                        function() {
                            var field = {'label':this.label, 'type':this.type, 'length': this.length};
                            fields[this.name] = field;
                            if (field.type == 'reference') {
                                field.relationshipName = this.relationshipName;
                                field.referenceTo = this.referenceTo;
                                field.relationshipLabel = this.relationshipLabel || '';
                                fields[this.relationshipName] = field;
                            }
                        });
                    StorageManager.setSessionValue(contact_describe_storage_key, JSON.stringify(fields));
                }
                if (response.recordTypeInfos && response.recordTypeInfos.length > 1) {
                    hasRecordTypes = true;
                }
                if (response.childRelationships) {
                    hasChatterEnabled = response.childRelationships.some(function(rel) {
                        return rel.childSObject == 'ContactFeed';
                    });
                }
            }, errorCallback, onComplete);
}

function createScroller(el, onPullDownCallback, ops) {
    
    var pullDownOffset, onRefresh, onScrollMove, onScrollEnd;
    var elem = (typeof el == 'object') ? el : $j('#' + el);
    
    if (onPullDownCallback) {
    
        var pullDownEl = elem.find('#pullDown')[0];
        
        if (!pullDownEl) {
            var pullDownElHtml = '<div id="pullDown"><span class="app-images appleui pullDownIcon"></span><span class="pullDownLabel">Pull down to refresh</span> </div>';
            $j(elem.children().children().get(0)).before(pullDownElHtml);
            pullDownEl = elem.find('#pullDown')[0];
        }
        
        pullDownOffset = pullDownEl.offsetHeight;
    
        onRefresh = function () {
            if (pullDownEl.className.match('loading')) {
                pullDownEl.className = '';
                pullDownEl.querySelector('.pullDownLabel').innerHTML = 'Pull down to refresh';
            }
        };
        
        onScrollMove = function () {
            if (this.y > 5 && !pullDownEl.className.match('flip')) {
                pullDownEl.className = 'flip';
                pullDownEl.querySelector('.pullDownLabel').innerHTML = 'Release to refresh';
                this.minScrollY = 0;
            } else if (this.y < 5 && pullDownEl.className.match('flip')) {
                pullDownEl.className = '';
                pullDownEl.querySelector('.pullDownLabel').innerHTML = 'Pull down to refresh';
                this.minScrollY = -pullDownOffset;
            }
        };
        
        onScrollEnd = function () {
            if (pullDownEl.className.match('flip')) {
                pullDownEl.className = 'loading';
                pullDownEl.querySelector('.pullDownLabel').innerHTML = 'Loading...';
                
                onPullDownCallback();   // Execute custom function (ajax call?)
            }
        };
    }
    
    var options = {useTransition: true, topOffset: pullDownOffset || 0 };
    if (ops && ops.onBeforeScrollStart) options.onBeforeScrollStart = ops.onBeforeScrollStart;
    if (onRefresh) options.onRefresh = onRefresh;
    if (onScrollMove) options.onScrollMove = onScrollMove;
    if (onScrollEnd) options.onScrollEnd = onScrollEnd;

    return new iScroll(elem[0], options);
}

function errorCallback(jqXHR, statusText){
    if (statusText == 'error') {
        var response = jqXHR.responseText;
        try { response = $j.parseJSON(response);} catch (e){}
        
        switch (jqXHR.status) {
            case 403: 
                if ((/NO_API_ACCESS/gi).test(jqXHR.responseText) && ManageUserSession.isActive()) {
                    alert(response.message);
                    logout(true);
                    break;
                }
            case 401:
                alert(response.message || 'Session expired. Please relogin.');
                ManageUserSession.invalidate(true, function() { window.location.reload(); });
                break;
            default:
                alert('Server Unavailable. Check network connection or try again later.');
        }
    } else if (statusText = 'timeout') {
        alert('Session timed out.');
        ManageUserSession.invalidate(true, function() { window.location.reload(); });
    }
}

var last_visited_loc_storage_key = 'LAST-VISIT-LOC';

function updateLastVisitLoc(path) {
    if (path) StorageManager.setLocalValue(last_visited_loc_storage_key, path);
    else StorageManager.clearLocalValue(last_visited_loc_storage_key);
}

function getEulaResponse(callback) {
    var onAccept = function() {

        var onSuccess = function(resp) {
            if (resp.success && resp.success == 'true') {
                ManageUserSession.updateEula(true);
                SettingsManager.hideEula();
                if (typeof callback == 'function') callback();
            } else {
                if (resp.error) alert(resp.error);
                if (resp.errorCode && resp.errorCode == 'INVALID_CLIENT') logout(false);
            }
        }
        ManageUserSession.getApiClient().submitEulaResponse(ManageUserSession.getClientId(), this.id, onSuccess, errorCallback);
    }
    
    var onDecline = function() {
        logout(true);
    }
    
    SettingsManager.showEula(onAccept, onDecline);
}

function logout(redirect) {
    var postLogout = function() {
        if (!redirect) StorageManager.setSessionValue(login_redirect_storage_key, false);
        window.location = getBaseUrl();
    }
    
    ManageUserSession.kill(postLogout);
}

function getContacts(filter, callback) {

    listView.showBusyIndicator('Loading...');
    var onComplete = function(jqXHR, statusText) {
        listView.updateList(sobjectModel.records);
        listView.hideBusyIndicator();
        listView.refreshScroller(function() { getContacts(filter); }); // Refresh scroller
        if (typeof callback == 'function') {
            callback(statusText == 'success');
        }
    }
    
    ManageUserSession.getApiClient().queryContactsViaApex(filter,
            function(response) {
                sobjectModel.setRecords(response.records);
            }, 
            errorCallback, onComplete);
}

function searchContacts(searchText, callback) {
    listView.showBusyIndicator('Searching...');
    var onComplete = function(jqXHR, statusText) {
        listView.updateList(sobjectModel.records);
        listView.hideBusyIndicator();
        listView.refreshScroller(function() { searchContacts(searchText); }); // Refresh scroller
        if (typeof callback == 'function') {
            callback(statusText);
        }
    }
    
    ManageUserSession.getApiClient().searchContactsViaApex(searchText,
            function(response) {
                sobjectModel.setRecords(response);
            }, 
            errorCallback, onComplete);
}

function prepareSession(clearSettings) {

    var redirect = StorageManager.getSessionValue(login_redirect_storage_key);
    if (redirect == 'false') {
        StorageManager.clearSessionValue(login_redirect_storage_key);
        setTimeout(SettingsManager.show, 10);
    } else {
        var onSessionActive = function() {
            if (!ManageUserSession.isEulaAccepted()) getEulaResponse(sessionCallback);
            else sessionCallback();
        }
        ManageUserSession.initialize(onSessionActive, clearSettings);
    }
}

if (sforce.Client === undefined) {

    /**
     * The Client provides a convenient wrapper for the Force.com REST API, 
     * allowing JavaScript in Visualforce pages to use the API via the Ajax
     * Proxy.
     * @param [clientId=null] 'Consumer Key' in the Remote Access app settings
     * @param [loginUrl='https://login.salesforce.com/'] Login endpoint
     * @param [proxyUrl=null] Proxy URL. Omit if running on Visualforce or 
     *                  PhoneGap etc
     * @constructor
     */
    sforce.Client = function() {
        this.sessionHeader = null;
        
        this.SESSION_HEADER = 'App-Session';
    }
    
    sforce.Client.prototype.ajax = function(type, url, data, success, error, complete) {
        var that = this;
        $j.ajax({
            type: type,
            url: url,
            processData: true,
            data: data,
            dataType: 'json',
            success: success,
            error: error,
            complete: complete,
            beforeSend: function(xhr) {
                if (that.sessionHeader)
                    xhr.setRequestHeader(that.SESSION_HEADER, that.sessionHeader);
            }
        });
    }
    
    sforce.Client.prototype.setSessionHeader = function(token) {
        this.sessionHeader = token;
    }
    
    /**
     * Get OAuth authorize URL.
     * @param host Instance against which authentication needs to be performed
     */
    sforce.Client.prototype.getAuthorizeUrl = function(host) {
        return getBaseUrl() + '/services/apexrest/oauth2/?doAuthorize&host=' + host;
    }

    /**
     * Refresh the access token.
     * @param success function to call on success
     * @param error function to call on failure
     */
    sforce.Client.prototype.refreshAccessToken = function(passcode, clientId, refToken, success, error, complete) {
        var url = getBaseUrl() + '/services/apexrest/oauth2/refreshAccess';
        this.ajax('POST', url, 'rt='+refToken+'&pass='+passcode+'&cid='+clientId, success, error, complete);
    }
    
    /**
     * Obtain the access token.
     * @param success function to call on success
     * @param error function to call on failure
     */
    sforce.Client.prototype.obtainAccessToken = function(host, authCode, passcode, success, error, complete) {
        var url = getBaseUrl() + '/services/apexrest/oauth2/authenticate';
        var data = 'code=' + authCode + (passcode ? ('&pass='+passcode) : '') + (host ? ('&host=' + host) : '');
        this.ajax('POST', url, data, success, error, complete);
    }
    
    /**
     * Refresh existing session.
     * @param success function to call on success
     * @param error function to call on failure
     * @param complete function to call on ajax call completion
     */
    sforce.Client.prototype.prepareSession = function(success, error, complete) {
        var url = getBaseUrl() + '/services/apexrest/oauth2/prepareSession';
        this.ajax('POST', url, null, success, error, complete);
    }
    
    /**
     * Prepare an app session from oauth values.
     * @param success function to call on success
     * @param error function to call on failure
     * @param complete function to call on ajax call completion
     */
    sforce.Client.prototype.prepareSessionFromOAuth = function(accessToken, instanceUrl, userIdentityUrl, success, error, complete) {
        var url = getBaseUrl() + '/services/apexrest/oauth2/prepareSession';
        var data = 'accessToken=' + accessToken + '&instanceUrl=' + instanceUrl + '&identityUrl=' + userIdentityUrl;
        this.ajax('POST', url, data, success, error, complete);
    }
    
    /**
     * Revokes existing session.
     * @param success function to call on success
     * @param error function to call on failure
     * @param complete function to call on ajax call completion
     */
    sforce.Client.prototype.revokeSession = function(clientId, refToken, success, error, complete) {
        var url = getBaseUrl() + '/services/apexrest/oauth2/revokeSession';
        var data = (clientId && refToken) ? ('cid=' + clientId  + '&rt=' + refToken) : '';
        this.ajax('POST', url, data, success, error, complete);
    }
    
    /**
     * Query Contacts
     * @param success function to call on success
     * @param error function to call on failure
     */
    sforce.Client.prototype.queryContactsViaApex = function(filter, success, error, complete) {
        var url = getBaseUrl() + '/services/apexrest/cvapi';
        this.ajax('GET', url, 'action=fetchContacts&filter=' + filter, success, error, complete);
    }
    
    /**
     * Query Contacts
     * @param success function to call on success
     * @param error function to call on failure
     */
    sforce.Client.prototype.retrieveContactViaApex = function(contactId, fields, success, error, complete) {
        var url = getBaseUrl() + '/services/apexrest/cvapi';
        this.ajax('GET', url, 'action=retrieveContact&id=' + contactId + '&fields=' + fields, success, error, complete);
    }
    
    /**
     * Search Contacts
     * @param success function to call on success
     * @param error function to call on failure
     */
    sforce.Client.prototype.searchContactsViaApex = function(text, success, error, complete) {
        var url = getBaseUrl() + '/services/apexrest/cvapi';
        this.ajax('GET', url, 'action=searchContacts&text=' + text, success, error, complete);
    }
    
    /**
     * Fetch chatter for a contact
     * @param success function to call on success
     * @param error function to call on failure
     */
    sforce.Client.prototype.fetchChatterViaApex = function(contactIdArr, success, error, complete) {
        var url = getBaseUrl() + '/services/apexrest/cvapi';
        this.ajax('GET', url, 'action=fetchChatter&ids=' + contactIdArr, success, error, complete);
    }
    
    /**
     * Fetch activities for a contact
     * @param success function to call on success
     * @param error function to call on failure
     */
    sforce.Client.prototype.fetchActivitiesViaApex = function(contactIdArr, success, error, complete) {
        var url = getBaseUrl() + '/services/apexrest/cvapi';
        this.ajax('GET', url, 'action=fetchActivities&ids=' + contactIdArr, success, error, complete);
    }
    
    /**
     * Get Users details
     * @param success function to call on success
     * @param error function to call on failure
     */
    sforce.Client.prototype.getUsersInfoViaApex = function(uids, fetchPhotos, success, error, complete) {
        var url = getBaseUrl() + '/services/apexrest/cvapi';
        this.ajax('GET', url, 'action=getUsersInfo&id=' + uids + '&fetchPhotos=' + fetchPhotos, success, error, complete);
    }
    
    
    /**
     * Get Contact Describe info
     * @param success function to call on success
     * @param error function to call on failure
     */
    sforce.Client.prototype.describeContactViaApex = function(success, error, complete) {
        var url = getBaseUrl() + '/services/apexrest/cvapi';
        this.ajax('GET', url, 'action=describeContact', success, error, complete);
    }
    
    /**
     * Get Contact Detail Layout
     * @param success function to call on success
     * @param error function to call on failure
     */
    sforce.Client.prototype.getContactDetailsViaApex = function(contactId, recordTypeId, success, error, complete) {
        var that = this;
        var url = getBaseUrl() + '/ContactDetails';
        var timezoneOffset = new Date().getTimezoneOffset();
        $j.ajax({
            type: 'GET',
            url: url,
            data: 'id=' + contactId + '&rtid=' + (recordTypeId || '') + '&tzOffset=' + timezoneOffset,
            success: success,
            error: error,
            complete: complete,
            beforeSend: function(xhr) {
                if (that.sessionHeader)
                    xhr.setRequestHeader(that.SESSION_HEADER, that.sessionHeader);
            }
        });
    }
    
    /**
     * Get Contact App Eula
     * @param success function to call on success
     * @param error function to call on failure
     */
    sforce.Client.prototype.getContactAppEula = function(success, error, complete) {
        var url = getBaseUrl() + '/ContactsAppEula';
        $j.ajax({
            type: 'GET',
            url: url,
            success: success,
            error: error,
            complete: complete
        });
    }
    
    /**
     * Get Contact App Eula
     * @param success function to call on success
     * @param error function to call on failure
     */
    sforce.Client.prototype.submitEulaResponse = function(clientId, response, success, error, complete) {
        var url = getBaseUrl() + '/services/apexrest/cvapi';
        this.ajax('GET', url, 'action=manageEula&clientId='+ clientId + '&eulaResponse=' + response, success, error, complete);
    }
}

var SettingsManager = (function () {
    
    var settings, initialized, settingsScroller, scrollerOnPage, overlay, customHostInFocus = false;
    
    var _setup = function() {
        if (!initialized) {
            initialized = true;
            settings = $j('#app_settings');
            _addEventListeners();
        }

        _renderConnectionInfo();
        settings.find('#header #title').text('Settings');
        settings.find('.page').css('visibility', 'hidden'); //Hide all panels
        settings.find('#main').css('visibility', 'visible');

        if (settings.width() < 500) settings.find('#header #left>div').text('Back');
        
        if (ManageUserSession.isActive()) {
            settings.find('#header #done').show();
            settings.find('#loginbtn').hide();
            settings.find('#logoutbtn').show();
        } else {
            settings.find('#loginbtn').show();
            settings.find('#logoutbtn').hide();
        }
    }
    
    function _initiateScroller(page) {
        if (page && scrollerOnPage != page) {
            if (settingsScroller) _destroyScroller();
            
            settingsScroller = createScroller(settings.find('.settings_body ' + page), null, {onBeforeScrollStart: function() {}});
            scrollerOnPage = page;
            $j(window).orientationChange( function() { _initiateScroller(); } );
        } else if (settingsScroller) {
            settingsScroller.refresh();
        }
        settings.find('.settings_body ' + scrollerOnPage + ' a').unbind().touch(function(e) { e.stopPropagation(); });
    }
    
    var _destroyScroller = function() {
        if (settingsScroller) {
            settingsScroller.destroy();
            settingsScroller = undefined;
            scrollerOnPage = undefined;
        }
    }
    
    var _renderConnectionInfo = function() {
        var host = ManageUserSession.getLoginHostType();
        
        if (!host) {
            host = settings.find('#hosts table td')[0].id;
            ManageUserSession.setLoginHostType(host);
        }
        var hostLabel = 'Production';
        
        if (host) {
            settings.find('#connection #hostType #name').text(
                settings.find('#hosts #' + host + ' span').text()
            );
            settings.find('#hosts table td').css('color', 'black');
            settings.find('#hosts #' + host).css('color', '#395483').append(settings.find('#hosts #check'));
        }
        settings.find('#main #connection #host_url input').val(
            ManageUserSession.getLoginHostUrl()
        );
    }
    
    var _switchBack = function(from) {
        settings.find('#header #left').show().touch(
            function() {
                settings.find('#header #left').hide().unbind();
                if (useAnimations) {
                    from.changePage(settings.find('#main'), true, function() { from.css('visibility', 'hidden'); } );
                } else {
                    from.hide();
                    settings.find('#main').show().css('visibility', '');
                }
                settings.find('#header #title').text('Settings');
                if(ManageUserSession.isActive()) settings.find('#header #done').show();
                _initiateScroller('#main');
            }
        );  
    }
    
    var _addEulaResponseListeners = function(onAccept, onDecline) {
        var buttons = settings.find('#eula_buttons').show();
        buttons.find('#accept').unbind().click(onAccept);
        buttons.find('#decline').unbind().click(onDecline);
    }
    
    var _showEula = function(showButtons, callback) {
        var onSuccess = function(response) {
            var resp = $j(response); 
            resp.find('head, script').remove();
            settings.find('#eula .content').empty().append(resp);
            if (showButtons) {
                var buttons = settings.find('#eula_buttons').show();
                settings.find('#eula').css('margin-bottom', buttons.outerHeight() + 'px');
            } else {
                settings.find('#eula').css('margin-bottom', '0');
            }
        }
        
        var onComplete = function(jqXhr, textStatus) {
            _initiateScroller('#eula');
            if (typeof callback == 'function') callback(textStatus);
        }
        
        ManageUserSession.getApiClient().getContactAppEula(onSuccess, errorCallback, onComplete);
    }
    
    var _navigatePage = function(to, titleText, showBackButton, cb) {
        var that = $j(this), onChangePage;
        
        if (customHostInFocus) {
            setTimeout(function() {
                settings.find('#main #connection #host_url input').blur();
            }, 10);
        }
        
        that.addClass('cellselected');
        settings.find('#header #done').hide();
        
        onChangePage = function() { 
            that.removeClass('cellselected'); 
            settings.find('#main').css('visibility', 'hidden');
            if (typeof cb == 'function') cb();
        }
        if (useAnimations) {
            settings.find('#main').changePage(settings.find(to), false, onChangePage);
        } else {
            settings.find('#main').hide();
            settings.find(to).show().css('visibility', '');
            onChangePage();
        }
        settings.find('#header #title').text(titleText);
        _initiateScroller(to);
        if (showBackButton) _switchBack(settings.find(to));
    }
    
    var _navigatePageWithBack = function(to, titleText, cb) {
        _navigatePage(to, titleText, true, cb)
    }
    
    var _validateCustomHost = function() {
        var url = settings.find('#main #connection #host_url input').val().trim();
        var valid = (url.length == 0 || url.endsWith('.salesforce.com'));
        if (!valid) alert('Custom host url must end with ".salesforce.com".');
        return valid;
    }
    
    var _addEventListeners = function() {
        settings.find('#main #connection #hostType').click(
            function() { _navigatePageWithBack('#hosts', 'Login Host'); }
        );
        
        settings.find('#hosts table td').touch(
            function() {
                var that = $j(this);
                that.addClass('cellselected');
                ManageUserSession.setLoginHostType(this.id);
                _renderConnectionInfo();
                setTimeout(function() {that.removeClass('cellselected');}, 100);
            }
        );
        
        settings.find('#main #connection #host_url input').focus(
            function() {
                customHostInFocus = true;
                var that = $j(this);
                that.css('text-align', 'left');
            }
        ).blur(
            function() {
                customHostInFocus = false;
                $j(this).val(ManageUserSession.getLoginHostUrl());
                $j(this).css('text-align', 'right');
                setTimeout(function(){ $j(document.body).scrollTop(0); }, 10);
            }
        );
        
        settings.find('#main #connection #host_url form').submit(
            function() {
                var inputField = settings.find('#main #connection #host_url input');
                
                if(_validateCustomHost()) {
                    ManageUserSession.setLoginHostUrl(inputField.val());
                    _renderConnectionInfo();
                    inputField.blur();
                }
                return false;
            });
        
        settings.find('#main #help #help_about').click(
            function() { _navigatePageWithBack('#about', 'About'); }
        );
        
        settings.find('#main #help #help_faq').click(
            function() { 
                _navigatePageWithBack('#faq', 'FAQ', function() { /*_destroyScroller(); settingsScroller = createScroller(settings.find('#faq')); */}); 
            }
        );
        
        settings.find('#main #help #help_eula').click(
            function() { 
                _navigatePageWithBack('#eula', 'Contact Viewer EULA', _showEula);
            }
        );
        
        settings.find('#loginbtn').unbind()
                .click( function() { prepareSession(); } )
                .touch( function(e) { e.stopPropagation(); });
        settings.find('#logoutbtn').unbind().click(function(e) {
            // Delete the saved refresh token
            var resp = confirm('Logout user ' + ManageUserSession.getUsername() + '?');
            if (resp) {
                logout(false);
            }
        }).touch( function(e) { e.stopPropagation(); });
    };
    
    var _positionCenter = function() {
        settings.positionCenterOf(window);
    };
    
    return {
        show: function() {
            var initialY, finalY, onComplete;
            
            _setup();
            overlay = $j('#loggedin').addOverlay();
            settings.find('#username').setText(ManageUserSession.getUsername() || 'None');
    
            onComplete = function() {
                SettingsManager.hide();
                $j(this).unbind('click');
                if(!ManageUserSession.isActive()) window.location = getBaseUrl();
            }
            settings.find('#header #done').unbind('click').click(onComplete);
            if(!ManageUserSession.isActive()) settings.find('#header #done').hide();
        
            initialY = window.innerHeight;
            finalY = (window.innerHeight - settings.height())/2;
            
            settings.hide().css('zIndex', $j.topZIndex(overlay.elem) + 10)
                    .css({ left: (window.innerWidth - settings.width())/2 });
            if (useAnimations) {
                settings.css({top: 0}).show().slideIn('Y', initialY, finalY);
            } else settings.css({top: finalY}).show();
            
            _initiateScroller('#main');
            settings.orientationChange(_positionCenter);
        },

        hide: function(callback) {
            var finalY = window.innerHeight,
            onComplete = function() {
                settings.hide();
                overlay.hide();
                if (typeof callback == 'function') callback();
            };
            
            if (useAnimations) settings.slideOut('Y', finalY, onComplete);
            else onComplete();
            
            _destroyScroller();
            settings.unbindOrientationChange(_positionCenter);
        },
        
        showEula: function(onAccept, onDecline) {
            SettingsManager.show();
            _navigatePage('#eula', 'End User License Agreement', false, 
                function() { _showEula(true); _addEulaResponseListeners(onAccept, onDecline); });
        },
        
        hideEula: function() {
            SettingsManager.hide(function() {
                if (useAnimations) {
                    settings.find('#eula').changePage(settings.find('#main'), true);
                } else {
                    settings.find('#eula').hide();
                    settings.find('#main').show().css('visibility', '');
                }
                settings.find('#eula').css('visibility', 'hidden');
                settings.find('#eula_buttons').hide();
                settings.find('#header #title').text('Settings');
            });
        }
    };
})();

var FeedPhotoRenderer = function() { this.userIds = []; }

FeedPhotoRenderer.prototype.getImage = function(userId) {
    this.userIds.push(userId);
    return '<img class="feedImage app-images" id="photo__' + escape(userId) + '"/>';
}

FeedPhotoRenderer.prototype.renderImages = function(scope) {
    if (this.userIds.length == 0) return;
    
    if (!scope) scope = $j(document.body);
    if (hasChatterEnabled) {
        ManageUserSession.getApiClient().getUsersInfoViaApex(this.userIds, hasChatterEnabled,
                         function(response) {
                            $j.each(response.records, 
                                function () {
                                    scope.find('#photo__' + escape(this.Id)).removeClass('app-images').attr('src', this.SmallPhotoUrl);
                                }
                            );
                         }, errorCallback);
    }
}

function feedRenderer(records, noFeedMsg, options) {
    var feedWrapperDiv = $j('#feedscroller #feed');
    var feedList = feedWrapperDiv.find('ul');
    
    feedList.empty();
    feedWrapperDiv.find('div').remove();
    
    if (!records || records.length == 0) {
        feedWrapperDiv.append($j('<div style="padding-top:20px"></div>').text(noFeedMsg));
        return;
    }
    
    var photoRenderer = new FeedPhotoRenderer();
    var fieldInfos = getFieldDescribe();
    
    $j.each(records,
        function() {
            var rec = this;
            var type = rec.attributes.type;
            if (type == 'ContactFeed') {
                // add chatter item
                generateChatterItem(rec, feedList, photoRenderer, fieldInfos, options);
            } else if (type == 'Task') {
                // add task item
                generateTaskItem(rec, feedList, photoRenderer, options);
            }
        }
    );
    
    photoRenderer.renderImages(feedList);
}

//chatter feed renderer
function generateChatterItem(rec, parent, photoRenderer, fieldInfos, options) {

    var text = (rec.Body || '');
    if (rec.Type == 'TrackedChange' && rec.FeedTrackedChanges && rec.FeedTrackedChanges.records) {
        $j.each(rec.FeedTrackedChanges.records,
            function() {
                if (this.FieldName == 'created') text = 'created this ' + contactLabel.toLowerCase() + '.';
                else if (this.FieldName == 'contactUpdatedByLead') text = 'updated this ' + contactLabel.toLowerCase() + ' by converting a lead.';
                else if (this.FieldName == 'contactCreatedFromLead') text = 'converted a lead to this ' + contactLabel.toLowerCase() + '.';
                else if (this.NewValue != null || this.OldValue != null) {
                    var fieldLabel;
                    var fieldInfo = fieldInfos[this.FieldName.split('.')[1]]; 
                    
                    if (fieldInfo) fieldLabel = fieldInfo.label;
                    else return;
                    
                    text = ('updated ' + fieldLabel + ' from ' + (this.OldValue || 'blank') + ' to ' + (this.NewValue || 'blank'));
                }
            }
        );
    }
    
    if (text && text.length > 0) {
        var feedItemParent;
        if (options && options.includeParent) {
            feedItemParent = $j('<span style="font-weight:bold"></span>').text(rec.Parent.Name);
            feedItemParent = $j('<a href="#"/>').attr('id', 'contact_' + htmlEncode(rec.Parent.Id)).append(feedItemParent);
            feedItemParent[0].onclick = options.onClickParent;
        }
    
        var feedBody = $j('<div class="feedBody"></div>').append(feedItemParent).append((feedItemParent) ? '&nbsp;-&nbsp;' : '')
                        .append($j('<strong></strong>').text(rec.CreatedBy.Name)).append('&nbsp;') 
                        .append($j('<span></span>').text(text)).append('<br/><span class="datetime">' +  $j.format.date(rec.CreatedDate, 'MMM dd, yyyy (at) hh:mm a') + '</span>');
        $j('<li></li>').append(photoRenderer.getImage(rec.CreatedBy.Id)).append(feedBody).appendTo(parent);
    }
}
         
                         
//Activity Feed renderer
function generateTaskItem(rec, parent, photoRenderer, options) {

    var feedItemParent;
    if (options && options.includeParent) {
        feedItemParent = $j('<span style="font-weight:bold"></span>').text(rec.Who.Name);
        feedItemParent = $j('<a href="#"/>').attr('id', 'contact_' + htmlEncode(rec.Who.Id)).append(feedItemParent);
        feedItemParent[0].onclick = options.onClickParent;
    }
    
    //var image = '<img class="feedImage" id="task_icon" src="' + staticRsrcUrl + '/images/icons/tasks.png' + '"/>';
    var feedBody = $j('<div class="feedBody"></div>').append(feedItemParent).append((feedItemParent) ? '&nbsp;-&nbsp;' : '')
                    .append($j('<strong></strong>').text(rec.Owner.Name)).append(' ' + (rec.IsClosed ? 'completed' : 'owns') + ' the task<br/>')
                    .append($j('<span></span>').text(rec.Subject || '')).append('<br/><span class="datetime">' + (rec.ActivityDate ? 'Due on ' + $j.format.date(rec.ActivityDate, 'MMM dd, yyyy') : 'No Due Date.') + '</span>');   
    $j('<li></li>').append(photoRenderer.getImage(rec.Owner.Id)).append(feedBody).appendTo(parent);
}

if (sforce.ListView === undefined) {

    /**
     * The ListView provides a convenient wrapper for initializing and managing the list view 
     * UI component.
     * @param [listOptions] Options such as (onListSelect, onSearch, onItemSelect).
     * @constructor
     */
    sforce.ListView = function(listOptions) {
        var that = this;
        
        // Default options
        that.options = {
            onListSelect: null,
            onSearch: null,
            onItemSelect: null,
            listTypes: {'owner':'My Records', 'follow':'Records I Follow', 'recent':'Recently Viewed'}
        };
        
        // User defined options
        for (i in that.options) that.options[i] = listOptions[i];
        
        that.selectedContactId = listOptions.selectedContactId;
        that.view = $j('#listpage');
        that._init();
    }
    
    sforce.ListView.prototype = {
    
        _init : function() {
            var that = this;
            
            var _hideListSelectButtons = function(listOverlay) {
                
                var selecterDiv = that.view.find('#header #listselect');
                
                var onComplete = function() {
                    if (listOverlay) listOverlay.hide();
                    that.view.find('#header #searchbar').show();
                    selecterDiv.unbind('webkitTransitionEnd').hide();
                    selecterDiv.css('zIndex', '');
                    selecterDiv.prev().css('zIndex', '');
                    that.showingListSelector = false;
                }
                selecterDiv.bind('webkitTransitionEnd', onComplete);
                
                selecterDiv.css('-webkit-transform', 'translateY(-' + selecterDiv.height() + 'px)');
            }
            
            var _showListSelectButtons = function() {
                
                if (that.showingListSelector) return;
                else that.showingListSelector = true;
                
                var selecterDiv = that.view.find('#header #listselect'),
                    listOverlay = that.view.find('#listscroller').addOverlay(),
                    overlayZIndex = $j.topZIndex(listOverlay.elem);
                    
                var onShow = function() {
                    
                    that.view.find('#header #searchbar').hide();
                    selecterDiv.css('visibility', '').css('-webkit-transform', 'translateY(0px)')
                    
                    var elemTouch = function(e) {
                        e.preventDefault(); 
                        
                        var theTarget = e.target;
                        
                        //clear search 
                        that.view.find('#header #searchbar>form>input[type=search]').val('');
                        that.view.find('#header #searchbar>form>button').hide();
                        
                        _hideListSelectButtons(listOverlay); 
                        that._displayList(theTarget.id);
                        
                        return true;
                    }
                    var externalTouch = function(e) { 
                        var theTarget = e.target;
                        if (theTarget.nodeType == 3) theTarget = theTarget.parentNode;
                    
                        var listPage = $j('#listpage');
                        if ($j(theTarget).is(listPage) || listPage.has(theTarget).length > 0) e.preventDefault(); 
                        
                        _hideListSelectButtons(listOverlay); return true; 
                    }
                    selecterDiv.find('button').windowTouch(elemTouch, externalTouch, true);
                }
                
                selecterDiv.prev().css('zIndex', overlayZIndex+2);
                selecterDiv.css('zIndex', overlayZIndex+1);
                selecterDiv.css(vendor+'TransitionProperty', '').css('-webkit-transform', 'translateY(-' + selecterDiv.height() + 'px)');
                selecterDiv.css(vendor+'TransitionProperty', '-webkit-transform').css('visibility', 'hidden').show('fast', onShow);
            }
        
            that._addSearchListeners();
            that.view.find('#header #titlebar').unbind().click(_showListSelectButtons);            
            that.view.find('#listscroller #scroller #contactlist').unbind().click(
                function(e) {
                    var theTarget = e.target;
                    
                    if (that.loadingItem) return;
                    
                    theTarget = $j(theTarget).closest('li', that.view);
                    e.preventDefault();
                    
                    if (theTarget.length && !theTarget.hasClass('listseparater') && 
                        typeof that.options.onItemSelect == 'function') {
                        that.selectContact(theTarget[0].id.substring(8));
                    }
                });
        },
        
        _addSearchListeners : function() {
            var that = this;
            
            var searchInFocus = function() { 
                var jqthat = $j(this);
                jqthat.windowTouch(function() {return false;}, function() { jqthat.blur(); return true; }, false);
            }
            var searchTextChange = function() { 
                var jqthat = $j(this);
                if(jqthat.val().length > 0)  {
                    jqthat.next().show(); 
                } else {
                    jqthat.next().hide(); 
                }
            }
            var onSubmit = function() {
                var text = $j(this).find('input[type=search]').blur().val();
                text = text.trim();
                if (text.length > 1 && !text.startsWith('*')) {
                    that.mode = "search";
                    that.view.find('#header #titlebar #title').html('Search Results');
                    if (typeof that.options.onSearch == 'function') that.options.onSearch(text);
                }
                return false;
            }
            that.view.find('#header #searchbar>form').submit(onSubmit);
            that.view.find('#header #searchbar>form>input[type=search]').focusin(searchInFocus).bind('keydown', searchTextChange).bind('keyup', searchTextChange);
            that.view.find('#header #searchbar #closebutton').click(function(e) {
                e.preventDefault(); 
                $j(this).hide().prev().val('').blur();
                if (that.mode == 'search') {
                    that._displayList(that.selectedListId);
                    that.mode = 'list';
                }
            });
        },
        
        _displayList : function(listId) {
        
            var that = this, listButton;
            
            if (listId) listButton = that.view.find('#header #listselect button#' + listId);
            else listButton = that.view.find('#header #listselect button#recent');
            
            that.view.find('#header #titlebar #title').text(listButton.text());
            
            that.selectedListId = listButton[0].id;
            
            if (typeof that.options.onListSelect == 'function') {
                that.options.onListSelect(that.selectedListId);
            }
        },
        
        _initiateContactListScroller : function(pullDownCallback) {
            var that = this;
        
            if (typeof pullDownCallback == 'function') {
                that.contactListPullDownCB = pullDownCallback;
            }
            
            if (that.listpagescroll === undefined) {
                var callback = function() { 
                    //This way we can update the underlying callback without updating the callback on scroller.
                    if (typeof that.contactListPullDownCB == 'function') that.contactListPullDownCB(); 
                }
                that.listpagescroll = createScroller('listscroller', callback);
                $j(window).orientationChange(that._initiateContactListScroller);
            } else if (that.listpagescroll) {
                that.listpagescroll.refresh();
            }
        },
                
        //PUBLIC METHODS

        updateList : function(recs) {
            var that = this;
            
            var listContainer = that.view.find('#listscroller #scroller #contactlist');
            var listSummary = that.view.find('#listscroller #scroller #resultCount');
            
            listContainer.empty(); listSummary.empty();

            if(!recs || recs.length == 0) {
                listSummary.text('No ' + contactPluralLabel + ' Found');
            } else {
                listSummary.text('Found ' + recs.length + ' ' + contactPluralLabel);
            }
                
            recs.sort(function(x, y) {
                var a = x.LastName.toLowerCase(); var b = y.LastName.toLowerCase();
                return ((a == b) ? 0 : ((a > b) ? 1 : -1 ));
            });
            var chars = [];     
            
            $j.each(recs, 
                function () {
                    var id = htmlEncode(this.Id);
                    var rec = this;
                    if (chars.length == 0 || (this.LastName != null && chars.last() != this.LastName[0].toUpperCase())) {
                        chars.push(this.LastName[0].toUpperCase());
                        $j('<li></li>').addClass('listseparater').text(chars.last()).appendTo(listContainer);
                    }
                    
                    var listElem = $j('<li></li>').attr('id', 'contact_' + id);
                    if (id == that.selectedContactId) listElem.addClass('cellselected');
                    listElem.text((this.FirstName || '') + ' ')
                            .append($j('<strong></strong>').text(this.LastName || ''))
                            .appendTo(listContainer);
                });
        },
        
        resetSelectedContact : function() {
            this.selectedContactId = null;
            this.view.find('#contactlist .cellselected').removeClass('cellselected');
        },
        
        selectContact : function(contactId) {
            var that = this;
            that.resetSelectedContact();
            that.selectedContactId = contactId;
            that.view.find('#contactlist li#contact_' + contactId).addClass('cellselected');
            that.loadingItem = true;
            that.options.onItemSelect(that.selectedContactId, function() { that.loadingItem = false; });
        },
        
        showBusyIndicator : function(text) {
            this.busyInd = this.view.find('#listscroller').showActivityInd(text);
        },
        
        hideBusyIndicator : function() {
            if (this.busyInd) this.busyInd.hide();
        },
        
        refreshScroller : function(onRefreshCallback) {
            this._initiateContactListScroller(onRefreshCallback);
        }
    }
}

var ManageUserSession = (function() {

    var sfdc_token_storage_key = 'SFDC-OAUTH-TOKEN';
    var sfdc_clientId_storage_key = 'SFDC-CLIENT-ID';
    var login_host_storage_key = 'SFDC-LOGIN-HOST';
    var login_host_url_storage_key = 'SFDC-LOGIN-HOST-URL';
    var session_token_storage_key = 'SFDC-SESSION-TOKEN';
    
    var sf, sessionAlive, username, instanceUrl, eulaAccepted;
    var isStandalone = ('standalone' in navigator && navigator.standalone);

    function storeOAuthValues(cid, rt) {
        if (cid && cid.length > 0) StorageManager.setLocalValue(sfdc_clientId_storage_key, cid);
        if (rt && rt.length > 0) StorageManager.setLocalValue(sfdc_token_storage_key, rt);
    }
    
    function prepareSession(response) {
        sessionAlive = true;
        username = response.username;
        instanceUrl = response.instanceUrl;
        eulaAccepted = response.eula;
        sf.setSessionHeader(response.sessionToken);
        StorageManager.setSessionValue(session_token_storage_key, response.sessionToken);
    }
    
    function resurrectSession(sessionToken, onSuccess) {
        sf.setSessionHeader(sessionToken);
        
        var errorCallback = function() {
            sf.setSessionHeader(null);
            StorageManager.clearSessionValue(session_token_storage_key);
            ManageUserSession.initialize(onSuccess);
        }
        
        var successCallback = function(response) {
            if (response.success) {
                prepareSession(response);
                if (typeof onSuccess == 'function') onSuccess();
            } else errorCallback();
        };
        
        sf.prepareSession(successCallback, errorCallback);
    }

    function authenticate(callback) {

        var validatePasscodeAndRefreshSession = function(passcode, pmcallback) {
        
            // Logout Action
            if (passcode == -1) {
                var resp = confirm('Logout user?');
                if (resp) logout(true);
                else if (typeof pmcallback == 'function') pmcallback(false);
            } else {
                var ind = $j(document).showActivityInd('Authenticating...', false);
                
                var checkResponse = function(response) {
                
                    if (response.success) {
                        prepareSession(response);
                        
                        if (typeof pmcallback == 'function') pmcallback(true);
                        if (typeof callback == 'function') callback();
                        
                    } else {
                        if (response.errorCode == 'INVALID_TOKEN') StorageManager.clearAll();
                        if (typeof pmcallback == 'function') pmcallback(response.success, response.error);
                    }
                }
            
                var errorCallback = function(jqXHR, statusText) {
                    var msg;
                    if (statusText == 'error') {
                        msg = 'Server Unavailable. Check network connection or try again later.';
                    } else if (statusText = 'timeout') {
                        msg = 'Request timed out. Please try again.';
                    }
                    if (typeof pmcallback == 'function') pmcallback(false, msg);
                }
        
                var clientId = StorageManager.getLocalValue(sfdc_clientId_storage_key);
                var refToken = StorageManager.getLocalValue(sfdc_token_storage_key);
        
                sf.refreshAccessToken(passcode, clientId, refToken, checkResponse, errorCallback, ind.hide);
            }
        }
    
        PasscodeManager.checkPasscode(validatePasscodeAndRefreshSession);
    }
    
    function getLoginHostUrl() {
        var domain;
        
        switch(ManageUserSession.getLoginHostType()) {
            case 'host_production' : domain = 'login.salesforce.com'; break;
            case 'host_sandbox': domain = 'test.salesforce.com'; break;
            case 'host_custom': domain = StorageManager.getLocalValue(login_host_url_storage_key); break;
        }
        if (!domain || domain.length == 0) {
            domain = 'login.salesforce.com';
        }
        return domain;
    }

    function authorizeUser() {
        window.location = sf.getAuthorizeUrl(ManageUserSession.getLoginHostUrl());
    }
    
    function obtainOAuthTokensAndSetupPasscode(authCode, callback) {
    
        var fetchTokens = function(passcode, pmcallback) {
    
            passcode = (passcode == -1) ? undefined : passcode;
            var indMsg = (passcode) ? 'Setting Passcode...' : 'Authenticating...';
            var indicator = $j(document).showActivityInd(indMsg, false);
            
            var onSuccess = function(response) {
                prepareSession(response);
                storeOAuthValues(response.clientId, (passcode) ? response.refreshToken : null);
                
                // Callback the parent function which initiated the authentication.
                if (typeof callback == 'function') callback();
            }
            
            sf.obtainAccessToken(ManageUserSession.getLoginHostUrl(),
                                authCode, passcode, 
                                function(response) {
                                    indicator.hide();
                                    if (response.success) {
                                        onSuccess(response);
                                    } else {
                                        alert(response.error);
                                    }
                                    if (typeof pmcallback == 'function') pmcallback();
                                }, 
                                function() {
                                    if (confirm('Failed to obtain access. Try again!')) authorizeUser();
                                });
        };
            
        if (isStandalone) {
            PasscodeManager.setupPasscode(fetchTokens);
        } else {
            fetchTokens();
        }
    }
    
    return {
    
        isActive: function() { return sessionAlive == true; },
        
        isEulaAccepted: function() { return eulaAccepted == true; },
        
        updateEula: function(accepted) { eulaAccepted = accepted; },
        
        getClientId: function() { return (sessionAlive) ? StorageManager.getLocalValue(sfdc_clientId_storage_key) : null; },
        
        getUsername: function() { if (sessionAlive) return username; return null; },
        
        getApiClient: function() { if (sessionAlive) return sf; return null; },
        
        getLoginHostType: function() { return StorageManager.getLocalValue(login_host_storage_key); },
        
        getLoginHostUrl: getLoginHostUrl,
        
        setLoginHostType: function(host) { 
            if (host != ManageUserSession.getLoginHostType()) {
                StorageManager.setLocalValue(login_host_storage_key, host);
            }
        },
        
        setLoginHostUrl: function(hostUrl) { 
            hostUrl = hostUrl.toLowerCase();
            if (getLoginHostUrl() != hostUrl) {
                var hostType = 'host_custom';
                switch(hostUrl) {
                    case 'login.salesforce.com' : hostType = 'host_production'; break;
                    case 'test.salesforce.com' : hostType = 'host_sandbox'; break;
                }
                StorageManager.setLocalValue(login_host_url_storage_key, hostUrl); 
                ManageUserSession.setLoginHostType(hostType);
            }
        },
        
        initialize: function(callback, clearSettings) {
        
            if (!sf) sf = new sforce.Client();
            
            var sessionToken = StorageManager.getSessionValue(session_token_storage_key);        
            var refreshToken = StorageManager.getLocalValue(sfdc_token_storage_key);
        
            if (sessionAlive) { //Check if we are already initialized
                callback();
            } else if (sessionToken && sessionToken.length > 0) {
                resurrectSession(sessionToken, callback);
            } else if (refreshToken && refreshToken.length > 0) { 
                //Authenticate if we have the refresh token
                authenticate(callback);
            } else {
                // If nothing, the start the oauth process
                var isOAuthCallback = window.location.search.indexOf('code=');
                if (isOAuthCallback > 0) { //Are we coming back from an oauth process flow
                    var authCode = /code=([^&]*)&?/.exec(window.location.search)[1];
                    obtainOAuthTokensAndSetupPasscode(authCode, function() { history.pushState(null, null, window.location.pathname); callback(); });
                } else {
                    if (typeof clearSettings == 'boolean' && clearSettings) StorageManager.clearAll();
                    authorizeUser();
                }
            }
        },
        
        invalidate: function (revokeSession, postInvalidate) {
            if (revokeSession && sessionAlive) sf.revokeSession(null, null, null, null, postInvalidate);
            
            StorageManager.clearSessionValue(session_token_storage_key);
            sf = sessionAlive = username = undefined;
        },
        
        kill: function(postLogout) {
        
            var clientId = StorageManager.getLocalValue(sfdc_clientId_storage_key);
            var refToken = StorageManager.getLocalValue(sfdc_token_storage_key);
            
            var onRevoke = function() {
                ManageUserSession.invalidate(); 
                StorageManager.clearAll();
                if (typeof postLogout == 'function') postLogout();
            }
            
            sf.revokeSession(clientId, refToken, null, null, onRevoke);
        }
    }
})();

var PasscodeManager = (function () {

    var props, initialized;
    
    var _positionCenter = function() {
        var topLoc = ($j(window).height()/2 - props.passcodeElem.outerHeight()/2);
        var leftLoc = ($j(window).width()/2 - props.passcodeElem.outerWidth()/2);
        
        props.passcodeElem.css('top', topLoc + 'px').css('left', leftLoc + 'px');
    };
    
    var _positionBottom = function() {
        var transX, transY, transform;
        
        if (window.orientation == 90 || window.orientation == -90) {
/*          switch(window.orientation) {
                case 90: transX = ($j(window).width() - props.passcodeElem.height()/2 - props.passcodeElem.width()/2); break;
                case -90: transX = (props.passcodeElem.height()/2 - props.passcodeElem.width()/2); break;
            }
            transY = ($j(window).height()/2 - props.passcodeElem.height()/2);
            */
            transX = ($j(window).width()/2 - props.passcodeElem.width()/2);
            transY = ($j(window).height() - props.passcodeElem.height());
            transform = 'translate3d(' + transX + 'px, ' + transY + 'px, 0)';
        } else {
            transY = ($j(window).height() - props.passcodeElem.outerHeight());
            transform = 'translate3d(0px, ' + transY + 'px, 0)';
        }
        
        props.passcodeElem.css('-webkit-transition-property', 'none').css('-webkit-transform', transform);
    };
    
    var _positionForIphone = function() {
        if (window.innerHeight > window.innerWidth) {
            var cssTransform = {top:($j(window).height() - $j('#passcode table').outerHeight()) + 'px'};
                
            props.passcodeElem.css('visibility', 'hidden').css('opacity', '1').css(vendor + 'Transform', 'translateY('+ $j(window).height() + 'px)').show();
            props.passcodeElem.addClass('passcodeTransition').css('visibility', '').css(vendor + 'TransitionProperty', '-' + vendor.toLowerCase() + '-transform');
            props.passcodeElem.css(vendor + 'Transform', 'translateY('+ cssTransform.top + ')');
        } else {
            props.passcodeElem.css('visibility', 'hidden');
            setTimeout(function() { alert('Please switch to portrait mode to enter the passcode.'); }, 0);
        }
    };
    
    var _displayPasscodeWidget = function() {
        
        var displayWidget = function () {
            var that = this;
            var cssTransform;
        
            var windowSmallDimension = Math.min(window.innerWidth, window.innerHeight);
            
            if ((/ipad/gi).test(navigator.platform) || windowSmallDimension > $j('#passcode table').outerHeight()) {
                
                props.passcodeElem.css('opacity', '0'); 
                _positionCenter();
                props.passcodeElem.addClass('passcodeTransition').css(vendor + 'TransitionProperty', 'opacity').css('opacity', '1');
                props.passcodeElem.orientationChange(_positionCenter);
            } else {
                props.passcodeElem.orientationChange(_positionForIphone);
                _positionForIphone();
            }
        };
        
        props.passcodeElem.css('opacity', '0').show(); // Need to unhide to calculate height/width
        setTimeout(displayWidget, 0);
    };
    
    var _hidePasscodeInput = function() {
        
        var cssTransform;
        
        var afterAnimate = function() { 
                                props.passcodeElem.removeClass('passcodeTransition').css(vendor + 'TransitionProperty', 'none');
                                props.passcodeElem.hide().unbind('webkitTransitionEnd');
                                _destroy();
                            }; 
        
        props.passcodeElem.bind('webkitTransitionEnd', afterAnimate);
        
        if (((/ipad/gi).test(navigator.platform)) || ($j(window).width() > ($j('#passcode table').outerWidth() + 50))) {
            cssTransform = {opacity:0};
            props.passcodeElem.addClass('passcodeTransition').css(vendor + 'TransitionProperty', 'opacity').css('opacity', '0');
        } else {
            cssTransform = {top: $j(window).height() + 'px'};
            props.passcodeElem.addClass('passcodeTransition').css(vendor + 'TransitionProperty', '-' + vendor.toLowerCase() + '-transform');
            props.passcodeElem.css(vendor + 'Transform', 'translateY('+ cssTransform.top + ')');
        }
        
        //props.passcodeElem.animate(cssTransform, { duration: 500, complete: afterAnimate });
    };
    
    var _initialize = function() {

        if (initialized === undefined) {
            var buttons = props.passcodeElem.find('table td.passcode_button');

            buttons.each(
                function() {
                    var that = $j(this);
                    var value = that.text();
                    that.touch(
                        function(e) {
                            e.preventDefault(); e.stopPropagation();
                            if (props.elemNum < 4) {
                                $j(that).addClass('pressed');
                                setTimeout( function() { $j(that).removeClass('pressed'); }, 100);
                                _buttonClick(value);
                                if (props.elemNum == 4 && props.callback) {
                                    props.callback(props.passcode);
                                }
                            }
                        });
                });
            initialized = true;
        }
    };
    
    var _setup = function(callback) {
        props = {
            passcodeElem : $j('#passcode'),
            inputElems : $j('#passcode #passcode_input input'),
            elemNum : 0,
            passcode : '',
            callback : callback
        };
        _initialize();
        _setTitle(props.title);
        _reset();
    };
    
    var _reset = function() {
        _setTitle('Enter Passcode');
        _clearMsg();
        _clearPasscode();
    };
    
    var _clearPasscode = function() {
        props.elemNum = 0;
        props.passcode = '';
        props.inputElems.val('');
    };
    
    var _destroy = function() {
        if (props && props.passcodeElem)
            props.passcodeElem.unbindOrientationChange(_positionCenter);
        props = undefined;
    };
    
    var _setTitle = function(title) {
        $j('#passcode #passcode_title').html(title);
    };
    
    var _showMsg = function(msg, isError) {
        $j('#passcode #passcode_message').html(msg).show();
        if (isError)
            $j('#passcode #passcode_header').addClass('passcode_error');
    };
    
    var _clearMsg = function(msg) {
        $j('#passcode #passcode_message').empty().hide();
        $j('#passcode #passcode_header').removeClass('passcode_error');
    };

    var _buttonClick = function (elemVal) {
        var inpElem, domInpElem;
        
        if (elemVal == 'Logout' || elemVal == 'Cancel') {
            props.callback(-1);
        } else if (elemVal == 'Delete') {
            if (props.elemNum > 0) {
                props.inputElems[--props.elemNum].value = '';
                props.passcode = props.passcode.substr(0, props.elemNum);
            }
        } else if (parseInt(elemVal) >= 0) {
            props.inputElems[props.elemNum++].value = '.';
            props.passcode += elemVal;
        }
    };
    
    return {
        checkPasscode : function(validator, callback) { 

            var validate  = function(pass) { 
            
                var processResponse = function (resp, msg) {
                    if (resp) { 
                        _hidePasscodeInput();
                        if(typeof callback == 'function') callback();
                    } else {
                        //display error
                        _clearPasscode();
                        if (msg) {
                            _setTitle('Wrong Passcode');
                            _showMsg(msg, true);
                        }
                    }
                }
                
                if (validator) {
                    validator(pass, processResponse)
                }
            };
        
            _setup(validate);
            props.passcodeElem.find('#cancel').text('Logout');
            _displayPasscodeWidget();
        },
    
        setupPasscode : function(callback) {
            var temp;
            var validate = function(pass) {
                if (pass == -1) {
                    _hidePasscodeInput();
                    if(typeof callback == 'function') callback(-1);
                } else if (temp) {
                    if  (temp == pass) {
                        if(typeof callback == 'function') callback(props.passcode, _hidePasscodeInput);
                    } else {
                        temp = undefined;
                        alert('Passcode didn\'t match. Please try again.');
                        _reset();
                    }
                } else {
                    temp = pass;
                    _setTitle('Re-enter the passcode');
                    _clearPasscode();
                }
            };
    
            _setup(validate);
            _setTitle('Setup Passcode');
            props.passcodeElem.find('#cancel').text('Cancel');
            //props.passcodeElem('table #cancel').text('');
            _displayPasscodeWidget();
        }
    }
})();

if (sforce.SplitView === undefined) {

    /**
     * The ListView provides a convenient wrapper for initializing and managing the list view 
     * UI component.
     * @param [listOptions] Options such as (onListSelect, onSearch, onItemSelect).
     * @constructor
     */
    sforce.SplitView = function() {
        var that = this;
        
        that.callbacks = $j.Callbacks();

        that._init();

    }
    
    sforce.SplitView.prototype = {
    
        _init : function() {
            var that = this;
            
            isPortrait = function() {
                return (window.innerHeight > window.innerWidth);
            }
            
            var setupContactListSection = function() {
                /*that.view.find('#header #searchbar input[type="search"]').attr('placeholder', 'Search All ' + contactPluralLabel);
                that.view.find('#header #listselect #owner').text('My ' + contactPluralLabel);
                that.view.find('#header #listselect #follow').text(contactPluralLabel + ' I Follow');
                if(!hasChatterEnabled) that.view.find('#header #listselect button#follow').hide();*/
                
                switch (isPortrait()) {
                    case true:
                        $j('#listpage').appendTo('#popover');
                        $j('#popover').css('visibility', 'hidden').css('opacity', '0').show();
                        $j('#contactlist_button').show().text(contactPluralLabel).touch(function() {
                            $j('#popover,#contactlist_button').windowTouch( 
                                                            function() { return false; }, 
                                                            function() { that.focusOutContactList(); return true; }, 
                                                            false);
                            $j('#popover').css('visibility', '').css('opacity', '1');
                        });
                        break;
                    case false:
                        $j('#popover').hide();
                        $j('#rightsection').before($j('#listpage'));
                        $j('#contactlist_button').hide().unbindTouch();
                        $j('#popover,#contactlist_button').unbindWindowTouch();
                        break;
                }
                
                that.callbacks.fire(isPortrait());
            }
            
            // Bloody android fires resize on keyboard display too.
            var resetContactList = function() {
                if ((isPortrait() && $j('#listpage').parent()[0].id != 'popover') 
                    || (!isPortrait() && $j('#listpage').parent()[0].id == 'popover')) {
                    setupContactListSection();
                }
            }
            
            $j(window).orientationChange(resetContactList);
            setupContactListSection();
            
        },
        
                
        //PUBLIC METHODS
        
        focusOutContactList: function () {
                
            switch (window.innerHeight > window.innerWidth) {
                case true:
                    var popover = $j('#popover');
                    var onHide = function() { 
                        popover.css('visibility', 'hidden').unbind('webkitTransitionEnd');
                    }
                    if (popover.css('opacity') != '0')  popover.bind('webkitTransitionEnd', onHide);
                    popover.css('opacity', '0');
                    $j('#popover,#contactlist_button').unbindWindowTouch();
                    break;
                default:
            }
        },
        
        addOrientationChangeCallback: function(callback) {
            if (typeof callback == 'function')
                this.callbacks.add(callback);
        },
        
        removeOrientationChangeCallback: function(callback) {
            if (typeof callback == 'function')
                this.callbacks.remove(callback);
        }
    }

}

var StorageManager = (function() { 

    return {
        checkLocalStorage: function()
        {
            if (typeof(localStorage) == 'undefined') {
                return false;
            }
            return true;
        },
        
        checkSessionStorage: function()
        {
            if (typeof(sessionStorage) == 'undefined') {
                return false;
            }
            return true;
        },
         
        clearAll: function()
        {
            if (this.checkLocalStorage()) {
                localStorage.clear();
            }
            if (this.checkSessionStorage()) {
                sessionStorage.clear();
            }
        },
         
         
        setLocalValue: function(key, value)
        {
            if (this.checkLocalStorage()) {
                localStorage.setItem(key, value);
            }
        },
        
        getLocalValue: function(key)
        {
            if (this.checkLocalStorage()) {
                return localStorage.getItem(key);
            }
        },
         
        clearLocalValue: function(key)
        {
            if (this.checkLocalStorage()) {
                localStorage.removeItem(key);
            }
        },
        
        setSessionValue: function(key, value)
        {
            if (this.checkSessionStorage()) {
                sessionStorage.setItem(key, value);
            }
        },
        
        getSessionValue: function(key)
        {
            if (this.checkSessionStorage()) {
                return sessionStorage.getItem(key);
            }
        },
         
        clearSessionValue: function(key)
        {
            if (this.checkSessionStorage()) {
                sessionStorage.removeItem(key);
            }
        }
    }
})();